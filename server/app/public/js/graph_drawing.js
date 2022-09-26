const colors = ['lightskyblue', 'lightcoral', 'lightsalmon', 'lightslategray']


function sortJsonByKey(json) {
    return Object.keys(json).sort().reduce(
        (obj, key) => {
            obj[key] = json[key];
            return obj
        }, {}
    )
}

const sourceColorsBase = {
    'USERIO': 'darkgreen',
    'CACHE': 'darkred',
    'GC': 'yellow',
    'MAPPING': 'navy'
}

const sourceColors = sortJsonByKey(sourceColorsBase)

const typeColorsBase = {
    'READ': 'royalblue',
    'WRITE': 'tomato',
    'ERASE': 'yellowgreen'
}
const typeColors = sortJsonByKey(typeColorsBase)
const targetColor = {
    'X': '#ffffff00',
    'O': 'red'
}

const waitColor = 'darkslategray'

function getBackGroundColor(d) {
    if (d.txSource != 'USERIO') {
        return sourceColors[d.txSource]
    }

    let idx = globalThis.seenOrder[d.requestsId] % colors.length;
    return colors[idx];
}

function drawLegend(root, colors, title, className) {
    let arrColors = Object.keys(colors).map(d => [d, colors[d]])

    let legendRootG = root.append('g')

    legendRootG.append('rect')
        .attr('x', -4)
        .attr('y', -20)
        .attr('width', 86)
        .attr('height', arrColors.length * 20 + 20)
        .attr('fill-opacity', 0)
        // .attr('fill', '#A3CCBE')
        .attr('stroke', 'black')

    legendRootG.append('text')
        .text(title)
        .classed(className.title, true)
        .attr('x', 41)
        .attr('dy', '-0.25em')
        .style("text-anchor", "middle")


    let legendsG = legendRootG.append('g')
        .selectAll(null)
        .data(arrColors)
        .enter()
        .append('g')

    legendsG.append('rect')
        .attr('y', (d, i) => i * 20)
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', d => d[1])
        .classed(className.rect, true)

    legendsG.append('text')
        .attr('y', (d, i) => i * 20)
        .attr('x', 15)
        .attr('dy', '0.85em')
        .attr('dx', '0.2em')
        .text(d => d[0])
        .classed(className.text, true)
}

function drawLegends(root, style) {
    let legendG = d3.select('#legendG')
        .attr("transform", "translate(" + [style.boardW + style.pdg.l + 10, 50] + ")")

    let sourceLegendG = d3.select('#sourceLegendG')

    let typeLegendG = d3.select('#typeLegendG')
        .attr("transform", "translate(" + [0, 100] + ")")

    let delayLegendG = d3.select('#delayLegendG')
        .attr("transform", "translate(" + [0, 180] + ")")

    drawLegend(sourceLegendG, sourceColors, 'Source',
        { rect: 'legendRect', text: 'legendText', title: 'legendTitle' })

    drawLegend(typeLegendG, typeColors, 'Type',
        { rect: 'legendRect', text: 'legendText', title: 'legendTitle' })

    drawLegend(delayLegendG, {'WAIT': waitColor}, 'Wait-Sch',
        { rect: 'legendRect', text: 'legendText', title: 'legendTitle' })
}

function updateGraph(event, txs, style) {
    globalThis.yAxis.y2 = event.transform.rescaleY(globalThis.yAxis.y);
    globalThis.yAxis.self.scale(globalThis.yAxis.y2);
    globalThis.yGridAxis.self.scale(globalThis.yAxis.y2);

    globalThis.yAxis.self.tickValues(globalThis.yAxis.tickValues.slice(...globalThis.yAxis.domainIndex(true)))
    d3.select('#yAxisG').call(globalThis.yAxis.self)

    globalThis.yGridAxis.self.tickValues(globalThis.yGridAxis.gridValues.slice(...globalThis.yAxis.domainIndex()))

    let apprxYCnt = (globalThis.yAxis.y2.domain()[1]-globalThis.yAxis.y2.domain()[0]) / style.bar.cellH
    let gridWidth = style.boardW
    if (apprxYCnt >= 50) {
        gridWidth = 0;
    }
    globalThis.yGridAxis.self.tickSize(gridWidth, 0);
    d3.select('#yGridG').call(globalThis.yGridAxis.self);

    globalThis.xAxis.x2 = event.transform.rescaleX(globalThis.xAxis.x);
    d3.select('#xAxisG').call(globalThis.xAxis.self.scale(globalThis.xAxis.x2));

    drawBars(txs, style)
}

function drawInfoCols(root, style) {
    root.append('rect')
        .attr('width', style.info.w)
        .classed('sourceInfoRect', true)

    root.append('rect')
        .attr('x', style.info.w)
        .attr('width', style.info.w)
        .classed('typeInfoRect', true)

    updateInfoCols(root, style)
}

function updateInfoCols(update, style) {
    updateInfos(update.select('.sourceInfoRect'), style, d=>sourceColors[d.txSource])
    updateInfos(update.select('.typeInfoRect'), style, d=>typeColors[d.txType])
}

function updateInfos(update, style, colorSelector) {
    return update.attr('y', d => globalThis.yAxis.y2(d.order * style.bar.cellH - style.bar.mgn / 2))
        .attr('height', globalThis.yAxis.y2(style.bar.cellH) - globalThis.yAxis.y2(0))
        .attr('fill', colorSelector)
        .attr('stroke', colorSelector);
}

function drawBackgroundRect(root, style) {
    let newRect = root.append('rect')
        .classed('backgroundRect', true)
    updateBackgroundRect(newRect, style)
    return newRect
}

function updateBackgroundRect(update, style) {
    return update.attr('x', globalThis.xAxis.x2(globalThis.xAxis.range.lower))
        .attr('width', globalThis.xAxis.x2(globalThis.xAxis.range.upper) - globalThis.xAxis.x2(globalThis.xAxis.range.lower))
        .attr('y', d => globalThis.yAxis.y2(d.order * style.bar.cellH - style.bar.mgn / 2))
        .attr('height', globalThis.yAxis.y2(style.bar.cellH) - globalThis.yAxis.y2(0))
        .attr('fill', d => getBackGroundColor(d));
}

function updateBarRect(update, style) {
    update.attr('x', d => globalThis.xAxis.x2(d.host_interface_arrival_time))
        .attr('width', d => globalThis.xAxis.x2(d.flash_service_finish_time) - globalThis.xAxis.x2(d.host_interface_arrival_time))
        .attr('y', d => globalThis.yAxis.y2(d.order * style.bar.cellH))
        .attr('height', globalThis.yAxis.y2(style.bar.h) - globalThis.yAxis.y2(0))

    updateHoverTooltip(update)
    return update.attr('fill', d=>typeColors[d.txType])
}

function updateWaitRect(update, style) {
    update.attr('x', d => globalThis.xAxis.x2(d.tsu_arrival_time))
        .attr('width', d => globalThis.xAxis.x2(d.flash_scheduling_time) - globalThis.xAxis.x2(d.tsu_arrival_time))
        .attr('y', d => globalThis.yAxis.y2(d.order * style.bar.cellH))
        .attr('height', globalThis.yAxis.y2(style.bar.h) - globalThis.yAxis.y2(0))

    return update.attr('fill', waitColor)
}

function updateHoverTooltip(update) {
    const showingDict = {
        'service': d=>`service time: ${(d.flash_service_finish_time - d.host_interface_arrival_time).toLocaleString()}us`,
        'delay': d=>`delay time: ${(d.flash_scheduling_time - d.tsu_arrival_time).toLocaleString()}us`,
        'host_int_arr_time': d=>`host interface arrival time: ${d.host_interface_arrival_time.toLocaleString()}us`,
        'tsu_arr_time': d=>`tsu arrival time: ${d.tsu_arrival_time.toLocaleString()}us`,
        'flash_sche_time': d=>`flash scheduling time: ${d.flash_scheduling_time.toLocaleString()}us`,
        'flash_serv_fin_time': d=>`flash service finish time: ${d.flash_service_finish_time.toLocaleString()}us`,
        'id': d=>`db-id: ${d.id}`,
        'requestsId': d=>`requestsId: ${d.requestsId}`,
        'source': d=>`source: ${d.txSource}`,
        'type': d=>`type: ${d.txType}`,
        'txId': d=>`transaction id: ${d.txId}`
    }

    update.on('mouseover', null)
        .on('mousemove', null)
        .on('mouseout', null)

    return update.on('mouseover', function (event, ele) {
            let tooltip = d3.select('#tooltip')
            if (globalThis.tooltips.changed) {
                let using = Object.keys(showingDict).filter(x=>globalThis.tooltips.columns.has(x))
                
                tooltip.selectAll('g')
                    .data(using)
                    .join(
                        enter => {
                            let elementG = enter.append('g')
                            elementG.append('text')
                                .text(d=>showingDict[d](ele))
                            elementG.append('br')
                        },  
                        update => {
                            update.select('text')
                            .text(d=>showingDict[d](ele))
                        },
                        exit => {
                            exit.remove()
                        }
                    )
            }

            let vis = globalThis.tooltips.columns.size > 0 ? 'visible' : 'hidden';
            return tooltip.style('visibility', vis)
        })
        .on('mousemove', function (e) {
            return d3.select('#tooltip').style("top", (e.pageY - 10) + "px").style("left", (e.pageX + 10) + "px");
        })
        .on('mouseout', function (e) {
            return d3.select('#tooltip').style("visibility", "hidden");
        })
}

function drawBarRect(root, style) {
    let newRect = root.append('rect')
        .classed('barRect', true)
        .attr("clip-path", "url(#clippy)")

    return updateBarRect(newRect, style)
}

function drawWaitRect(root, style) {
    let newRect = root.append('rect')
        .classed('waitRect', true)
        .attr("clip-path", "url(#clippy)")

    return updateWaitRect(newRect, style)
}


function updateTargetRect(update, txs, style) {
    if (txs.length > 0 && 'target' in txs[0]) {
        let targetPos = txs.map(d => d.target).indexOf(1);
        if (targetPos != -1) {
            return update.attr('y', d => globalThis.yAxis.y2(txs[targetPos].order * style.bar.cellH - style.bar.mgn / 2))
                .attr('width', globalThis.xAxis.x2(globalThis.xAxis.range.upper) + style.info.totalW)
                .attr('height', globalThis.yAxis.y2(style.bar.cellH) - globalThis.yAxis.y2(0))
                .attr('visibility', 'visible')
        } else {
            update.attr('visibility', 'none')
        }
    } else {
        update.attr('visibility', 'none')
    }
}


function drawBars(txs, style) {
    let drawingBoard = d3.select('#drawingBoard');
    let graphTop = drawingBoard.select('#graphTop');
    let infoDrawing = drawingBoard.select('#infoDrawing');

    let data = txs.slice(...globalThis.yAxis.domainIndex(true))
    graphTop.selectAll('.bars')
        .data(data)
        .join(
            enter => {
                let bars = enter.append('g')
                    .classed('bars', true)
                drawBackgroundRect(bars, style)
                drawBarRect(bars, style)
                drawWaitRect(bars, style)
            },
            update => {
                updateBackgroundRect(update.select('.backgroundRect'), style)
                updateBarRect(update.select('.barRect'), style);
                updateWaitRect(update.select('.waitRect'), style)
            },
            exit => {
                exit.remove()
            }
        )

    infoDrawing.selectAll('.infoColG')
        .data(data)
        .join(
            enter => {
                let infoColG = enter.append('g')
                    .classed('infoColG', true)
                drawInfoCols(infoColG, style)
            },
            update => {
                updateInfoCols(update, style)
            },
            exit => {
                exit.remove()
            }
        )

    const lowerR = globalThis.yAxis.y2.invert(0)
    const upperR = (data[data.length-1].order + 1) * style.bar.cellH
    const barsH = globalThis.yAxis.y2(upperR - lowerR) - globalThis.yAxis.y2(0)
    const borderH = Math.min(style.boardH, barsH)
    d3.selectAll('.infoBorder')
        .attr('height', borderH)

    let targetRect = drawingBoard.select('#targetRect');
    updateTargetRect(targetRect, txs, style)
}

export {drawBars, updateGraph, drawLegends};
