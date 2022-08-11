import * as gd from "/js/graph_drawing.js";
import Sortable from '/sortablejs/modular/sortable.esm.js';

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

function menuClicked(e) {    
    const menu = d3.select('#options-content')

    const nextDisplay = menu.style('display') == 'none' ? 'block' : 'none';
    menu.style('display', nextDisplay)
}

function outsideClickChecker(e) {
    if (!document.getElementById('options').contains(e.target)) {
         d3.select('#options-content').style('display', 'none')
    }

    if (!document.getElementById('tooltipOption').contains(e.target)) {
        d3.select('#tooltipOption').style('display', 'none')
    }

    if (!document.getElementById('sortingOption').contains(e.target)) {
        d3.select('#sortingOption').style('display', 'none')
    }
}

function tooltipOptionClicked(e) {
    d3.select('#tooltipOption').style('display', 'block')
    d3.select('#options-content').style('display', 'none')
    e.stopPropagation()
}

function sortingOptionClicked(e) {
    d3.select('#sortingOption').style('display', 'block')
    d3.select('#options-content').style('display', 'none')
    e.stopPropagation()
}

function addSortingItemClicked(e) {
    let list = d3.select('#sortingItems').node()
    let copy = d3.select('.sortingListCopy').clone(true)
    copy.select('button').on('click', deleteSortingItemClicked)
    list.appendChild(copy.node())
    e.stopPropagation()
}

function deleteSortingItemClicked(e) {
    let item = e.target.closest('li')
    let list = e.target.closest('ol')

    list.removeChild(item)
    e.stopPropagation()
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
        globalThis.data = await result.json()
        info.text(`Total ${globalThis.data.length} transactions`)
        updateByNewData(style)
    } else {
        console.log('not okay')
        let alertDiv = d3.select('#alert')
            .style('display', 'block')
        setTimeout(() => alertDiv.style('display', 'none'), 1000);
        info.text(await result.text())
    }
}

async function onTargetClick() {
    let stmt = `select tx.*, (tx.id=${target}) as target from tx, (select * from tx where id = ${target}) A where A.gen <= tx.fin and tx.gen <= A.fin`

    console.log('STMT', stmt)

    let fetchUrl = `${window.location.protocol}//${window.location.host}/tx/${traceId}?sql=${stmt}`
    console.log(fetchUrl)
    let result = await fetch(fetchUrl)
    let info = d3.select('#info')
    if (result.ok) {
        globalThis.data = await result.json()
        info.text(`Total ${globalThis.data.length} transactions`)
        updateByNewData(style)
    } else {
        console.log('What')
        console.log('bad', result)
        info.text('Something went wrong')
    }
}

function updateByNewData(style) {
    sortData();
    saveSortingOption();

    let txs = globalThis.data
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

const stmtDefault = 'select * from tx';
const queryArea = d3.select('#queryArea')
    .attr('placeholder', stmtDefault)

const sqlSubmit = d3.select('#sqlSubmit')

if (!target) {
    sqlSubmit.text('click')
        .style('display', 'inline-block')
        .on('click', onclick)

    let targetSortOption = d3.select('#sortingItemCopy .sortingCol option[value=target]')
    targetSortOption.remove()
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
d3.select('#optionSorting').on('click', sortingOptionClicked)
window.addEventListener('click', outsideClickChecker)

let sortingItems = d3.select('#sortingItems')
Sortable.create(sortingItems.node())
d3.select('#addSortingItem').on('click', addSortingItemClicked)
    .node().click()
d3.select('#sortButton').on('click', sortButtonClicked)
d3.select('#revertButton').on('click', revertButtonClicked)
sortingItems.select('select').property('value', 'fin')

d3.select('#sqlSubmit').node().click()

function sortData() {
    let items = d3.selectAll('#sortingItems li')
    let columns = items.select('.sortingCol').nodes().map(d=>d.value);
    let orderBy = items.select('.sortingBy').nodes().map(d=>d.value);

    const columns2JSON = {
        gen: d=>d.gen,
        wait: d=>d.wait,
        sch: d=>d.sch,
        fin: d=>d.fin,
        requestsId: d=>d.requestsId,
        source: d=>d.txSource,
        type: d=>d.txType,
        txId: d=>d.txId,
        service: d=>d.fin-d.gen,
        delay: d=>d.sch-d.wait,
        target: d=>d.target
    }

    globalThis.data.sort((a, b) => {
        for (let idx=0; idx < columns.length; idx++) {
            let col = columns[idx]
            let comp = columns2JSON[col]
            let curOrder = orderBy[idx]
            let compA = comp(a)
            let compB = comp(b)
            if (compA != compB) {
                if (curOrder === 'asc'){ 
                    return compA > compB ? 1 : -1;
                }
                else {
                    return compA > compB ? -1 : 1;
                }
            }
        }
        return 0;
    })
}

function sortButtonClicked(e) {
    updateByNewData(style);
}

function saveSortingOption() {
    let items = d3.selectAll('#sortingItems li')
    let columns = items.select('.sortingCol').nodes().map(d=>d.value);
    let orderBy = items.select('.sortingBy').nodes().map(d=>d.value);
    globalThis.sortingOption = {
        columns: columns,
        orderBy: orderBy
    }
}

function revertButtonClicked(e) {
    let baseLength = globalThis.sortingOption.columns.length 
    let list = d3.select('#sortingItems').node();
    console.log('li', list.children)
    if (baseLength < list.children.length) {
        let curLen = list.children.length
        for (let i = 0; i < curLen - baseLength; i++) {
            list.removeChild(list.lastChild)
        }
    }

    if (list.children.length < baseLength) {
        let curLen = list.children.length
        for (let i = 0; i < baseLength - curLen; i++) {
            let copy = d3.select('.sortingListCopy').clone(true)
            copy.select('button').on('click', deleteSortingItemClicked)
            list.appendChild(copy.node())
        }
    }

    for (let i = 0; i < baseLength; i++) {
        list.children[i].querySelector('.sortingCol').value = globalThis.sortingOption.columns[i];
        list.children[i].querySelector('.sortingBy').value = globalThis.sortingOption.orderBy[i];
    }
}
