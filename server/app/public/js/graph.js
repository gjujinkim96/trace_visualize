import * as gd from "/js/graph_drawing.js"

function getSeenOrder(txs) {
    const requestsIdOrder = { 'CACHE': txs.length, 'GC': txs.length + 1, 'MAPPING': txs.length + 2 };
    let order = 0;

    txs.forEach(function (ele, i) {
        if (!(ele.requestsId in requestsIdOrder)) {
            requestsIdOrder[ele.requestsId] = order;
            order += 1;
        }
    });

    return requestsIdOrder;
}

// update.on('mouseover', null)
//         .on('mousemove', null)
//         .on('mouseout', null)

//     return update.on('mouseover', function (event, d) {
//         let tooltip = d3.select('#tooltip')
//         tooltip.select('#service').text(`service time: ${(d.fin - d.gen).toLocaleString()}us`)
//         tooltip.select('#start').text(`start: ${d.gen.toLocaleString()}us`)
//         tooltip.select('#end').text(`end: ${d.fin.toLocaleString()}us`)
//         return tooltip.style("visibility", "visible");
//     })
//         .on('mousemove', function (e) {
//             return d3.select('#tooltip').style("top", (e.pageY - 10) + "px").style("left", (e.pageX + 10) + "px");
//         })
//         .on('mouseout', function (e) {
//             return d3.select('#tooltip').style("visibility", "hidden");
//         })

function menuClicked() {    
    const menu = d3.select('#options-content')

    const nextDisplay = menu.style('display') == 'none' ? 'block' : 'none';
    menu.style('display', nextDisplay)
}

function outsideClickChecker(e) {
    if (!document.getElementById('options').contains(e.target)) {
         d3.select('#options-content').style('display', 'none')
    }

    if (!(document.getElementById('tooltipOption').contains(e.target) || 
        document.getElementById('optionTooltip').contains(e.target))) {
        d3.select('#tooltipOption').style('display', 'none')
    }
}

function tooltipOptionClicked() {
    d3.select('#tooltipOption').style('display', 'block')
    d3.select('#options-content').style('display', 'none')
}

async function onclick() {
    let stmt = d3.select('#queryArea').node().value;

    if (!stmt) {
        stmt = stmtDefault;
    }

    console.log('STMT', stmt)

    let result = await fetch(`${window.location.protocol}//${window.location.host}/tx/${traceId}?sql=${stmt}`)
    let info = d3.select('#info')
    if (result.ok) {
        let data = await result.json()
        info.text(`Total ${data.length} transactions`)
        updateByNewData(data, style)
    } else {
        console.log('not okay')
        let alertDiv = d3.select('#alert')
            .style('display', 'block')
        setTimeout(() => alertDiv.style('display', 'none'), 1000);
        info.text(await result.text())
    }
}

async function onTargetClick() {
    let stmt = `select tx.*, (tx.id=${target}) as target from tx, (select * from tx where id = ${target}) A where A.gen <= tx.fin and tx.gen <= A.fin order by tx.fin, tx.gen, tx.requestsId, tx.txId`

    console.log('STMT', stmt)

    let fetchUrl = `${window.location.protocol}//${window.location.host}/tx/${traceId}?sql=${stmt}`
    console.log(fetchUrl)
    let result = await fetch(fetchUrl)
    let info = d3.select('#info')
    if (result.ok) {
        let data = await result.json()
        info.text(`Total ${data.length} transactions`)
        updateByNewData(data, style)
    } else {
        console.log('What')
        console.log('bad', result)
        info.text('Something went wrong')
    }
}

function updateByNewData(txs, style) {
    console.log(`Total transactions: ${txs.length}`)
    globalThis.seenOrder = getSeenOrder(txs)
    txs.forEach(function (ele, i) {
        ele.order = i;
    });

    // set xAxis
    {
        let xr = {
            lower: d3.min(txs, d => d.gen),
            upper: d3.max(txs, d => d.fin),
        }
        xr.bound = [xr.lower, xr.upper]

        let xAx = {
            range: xr,
            x: d3.scaleLinear()
                .range([0, style.graphW])
                .domain(xr.bound),
        }
        xAx.x2 = xAx.x.copy()
        xAx.self = d3.axisTop(xAx.x2)

        globalThis.xAxis = xAx
    }

    d3.select('#xAxis').call(globalThis.xAxis.self);


    // set yAxis
    {
        const maxBars = Math.floor(style.boardH / style.bar.cellH);
        let yAx = {
            y: d3.scaleLinear()
                .range([0, style.boardH])
                .domain([0, maxBars * style.bar.cellH]),
            tickValues: txs.map((e, i) => i * style.bar.cellH + style.bar.h / 2),
            _cacheDomainIndex: null,
            domainIndex: function (shouldUpdate) {
                if (shouldUpdate || this._cacheDomainIndex === null) {
                    this._cacheDomainIndex = [
                        Math.max(Math.ceil((this.y2.domain()[0] - style.bar.h / 2) / style.bar.cellH), 0),
                        Math.ceil((this.y2.domain()[1] - style.bar.h / 2) / style.bar.cellH)
                    ]
                }
                return this._cacheDomainIndex;
            },
        }
        yAx.y2 = yAx.y.copy()
        yAx.self = d3.axisLeft(yAx.y2)
            .tickFormat(function (d) {
                let order = (d - style.bar.h / 2) / style.bar.cellH;

                if (txs[order].txSource === 'USERIO') {
                    return txs[order].requestsId + '=' + txs[order].txId
                } else {
                    return txs[order].txSource;
                }
            })
            .tickValues(yAx.tickValues.slice(...yAx.domainIndex()))

        globalThis.yAxis = yAx
    }

    d3.select('#yAxisG').call(globalThis.yAxis.self)

    // draw bars
    gd.drawBars(txs, style)

    {
        let gridV = txs.map(e => e.order * style.bar.cellH - style.bar.mgn / 2);
        let yGridAx = {
            gridValues: gridV
        }

        yGridAx.self = d3.axisRight(globalThis.yAxis.y2)
            .tickSize(style.boardW, 0)
            .tickFormat("")
            .tickValues(yGridAx.gridValues.slice(...globalThis.yAxis.domainIndex()))
        globalThis.yGridAxis = yGridAx
    }

    //draw grids
    d3.select('#yGridG').call(globalThis.yGridAxis.self)

    // handle zoom
    let xDomain = globalThis.xAxis.x.domain();
    let xRange = globalThis.xAxis.x.range();
    let moveRate = (xDomain[1] - xDomain[0]) / (xRange[1] - xRange[0]);
    let minExtent = -xDomain[0] / moveRate;
    const zoom = d3.zoom()
        .translateExtent([[minExtent, 0], [100000, 100000]])
        .on("zoom", function (event) {
            gd.updateGraph(event, txs, style);
        })

    let zoomObj = d3.select('#mainSvg').call(zoom);
    zoomObj.call(zoom.transform, d3.zoomIdentity)
}

const style = {
    mgn: { w: 20, h: 20 },
    pdg: { t: 20, b: 50, l: 80, r: 110, 
        get hori() { return this.l + this.r; },
        get vect() { return this.t + this.b; }
    },
    bar : {
        h: 20,
        mgn: 4,
        get cellH () { return this.h + this.mgn; }
    },
    info: { w: 30, cnt: 2, get totalW() { return this.w * this.cnt; } },

    get svgW() { return window.innerWidth - this.mgn.w; },
    get svgH() { return window.innerHeight - this.mgn.h; },
    get boardW() { return this.svgW - this.pdg.hori; },
    get boardH() { return this.svgH - this.pdg.vect; },
    get graphW () { return this.boardW - this.info.totalW; },
    get graphH() { return this.boardH; }
}

let url = new URL(window.location.href)
let traceId = url.searchParams.get('traceId')
let target = url.searchParams.get('target')

const stmtDefault = 'select * from tx order by fin';
const queryArea = d3.select('#queryArea')
    .attr('placeholder', stmtDefault)

const sqlSubmit = d3.select('#sqlSubmit')

if (!target) {
    sqlSubmit.text('click')
        .style('display', 'inline-block')
        .on('click', onclick)
} else {
    queryArea.style('display', 'none')
    sqlSubmit.style('display', 'none')
        .on('click', onTargetClick);
    // d3.select('#info').style('display', 'none')
}

const mainSvg = d3.select('#mainSvg')
    .attr("width", style.svgW)
    .attr("height", style.svgH);

d3.select('#plotArea')
    .attr("transform", "translate(" + [style.pdg.l, style.pdg.t] + ")")

gd.drawLegends(mainSvg, style)

d3.select('#clippyRect')
    .attr("width", style.boardW)
    .attr("height", style.boardH)

d3.select('#clippyjustgraphRect')
    .attr("width", style.graphW)
    .attr("height", style.graphH)

d3.select('#graphTop')
    .attr("transform", "translate(" + [style.info.totalW, 0] + ")")

d3.select('#srcBorder')
    .attr('width', style.info.w)

d3.select('#typeBorder')
    .attr('x', style.info.w)
    .attr('width', style.info.w)
 
d3.select('#xAxisG')
    .attr("transform", "translate(" + [style.info.totalW, 0] + ")")


d3.select('#infoAxis')
    .selectAll('text')
    .data(['S', 'T'])
    .join(enter => {
        enter.append('text')
            .text(d => d)
            .attr('x', (d, i) => (i + 1/2) * style.info.w)
            .attr('dx', '-0.3em')
            .attr('dy', '-0.15em')
    })

function setTooltipOption(using) {
    using.forEach(e=>d3.select(`#TC${e}`).property('checked', true))
}

let decodedCookie = decodeURIComponent(document.cookie)
let cookies = {};
let ars = decodedCookie.split(';').map(d=>d.trim().split('='))
ars.forEach(e=>cookies[e[0]] = e[1])

globalThis.tooltips = {
    columns: new Set(['service', 'delay', 'gen', 'wait', 'sch', 'fin']),
    changed: true,
}
if ('tooltipsOption' in cookies) {
    globalThis.tooltips.columns = new Set(JSON.parse(cookies['tooltipsOption']))
}

setTooltipOption(globalThis.tooltips.columns)

function optionChanged(ele) {
    const target = ele.target;
    if (target.checked) {
        globalThis.tooltips.columns.add(target.value);
    } else {
        globalThis.tooltips.columns.delete(target.value);
    }

    globalThis.tooltips.changed = true;
    document.cookie = `tooltipsOption=${JSON.stringify(Array.from(globalThis.tooltips.columns))};`
}

d3.selectAll('#tooltipOption input').on('change', optionChanged)

d3.select('#optionButton').on('click', menuClicked)
d3.select('#optionTooltip').on('click', tooltipOptionClicked)
window.addEventListener('click', outsideClickChecker)

d3.select('#sqlSubmit').node().click()