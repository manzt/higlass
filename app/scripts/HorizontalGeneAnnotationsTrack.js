import {scaleLinear} from 'd3-scale';
import {tileProxy} from './TileProxy.js';
import {HorizontalTiled1DPixiTrack} from './HorizontalTiled1DPixiTrack.js';
import boxIntersect from 'box-intersect';

export class HorizontalGeneAnnotationsTrack extends HorizontalTiled1DPixiTrack {
    constructor(scene, server, uid, handleTilesetInfoReceived) {
        super(scene, server, uid, handleTilesetInfoReceived);

    }

    initTile(tile) {
        //create texts
        tile.texts = {};

        tile.tileData.forEach(geneInfo => {
            let fill = 'blue';
            if (geneInfo[5] == '-') {
                fill = 'red';
            }
            let text = new PIXI.Text(geneInfo[3],  {fontSize:"10px", fontFamily:"Arial", fill:fill});
            if (this.flipText)
                text.scale.x = -1;

            text.anchor.x = 0.5;
            text.anchor.y = 1;

            tile.texts[geneInfo[3]] = text;  //index by geneName

            tile.graphics.addChild(text);
        });


        this.draw();
    }

    destroyTile(tile) {
        //remove texts

    }

    drawTile(tile) {

    }

    drawExons(graphics, txStart, txEnd, exonStarts, exonEnds, chrOffset, yMiddle) {
        exonStarts = exonStarts.split(',').map(x => +x + chrOffset)
        exonEnds = exonEnds.split(',').map(x => +x + chrOffset)

        let xStartPos = this._xScale(txStart);
        let xEndPos = this._xScale(txEnd);

        let lineHeight = 1.5;
        let exonHeight = 5;
        let yPos = yMiddle - lineHeight / 2;
        //let yPos = (d.height - lineHeight) / 2 + 5 ; //-(d.height - yScale(tileData[i]));
        let width = xEndPos - xStartPos;

        let yExonPos = yMiddle - exonHeight / 2;

        graphics.drawRect(xStartPos, yPos, width, lineHeight);

        for (let j = 0; j < exonStarts.length; j++) {
            let exonStart = exonStarts[j];
            let exonEnd = exonEnds[j];

            graphics.drawRect(this._xScale(exonStart), yExonPos, 
                    this._xScale(exonEnd) - this._xScale(exonStart), exonHeight);
        }
        
    }

    draw() {
        let graphics = this.pMain;
        let allVisibleTilesLoaded = this.areAllVisibleTilesLoaded();

        graphics.clear();

        let maxValue = 0;
        let allTexts = [];

        for (let fetchedTileId in this.fetchedTiles) {
            let ft = this.fetchedTiles[fetchedTileId];

            ft.tileData.forEach(geneInfo => {
                if (+geneInfo[4] > maxValue)
                    maxValue = geneInfo[4];
            });
        }

        //console.log('maxValue:', maxValue);
        let valueScale = scaleLinear()
            .domain([0, Math.log(maxValue+1)])
            .range([0,10]);
        let addedIds = [];

        //console.log('this.fetchedTiles:', this.fetchedTiles);
        for (let fetchedTileId in this.fetchedTiles) {
        //let visibleAndFetchedIds = this.visibleAndFetchedIds();

        //for (let i = 0; i < visibleAndFetchedIds.length; i++) {
            //let fetchedTileId = visibleAndFetchedIds[i];
            let ft = this.fetchedTiles[fetchedTileId];
            let parentInFetched = this.parentInFetched(ft);

            if (!parentInFetched)
                addedIds.push(ft.tileData.tileId);

            ft.tileData.forEach(geneInfo => {
                // the returned positions are chromosome-based and they need to
                // be converted to genome-based
                let chrOffset = +geneInfo[geneInfo.length-1];
                let txStart = +geneInfo[1] + chrOffset;
                let txEnd = +geneInfo[2] + chrOffset;
                let exonStarts = geneInfo[12], exonEnds = geneInfo[13];

                let txMiddle = (txStart + txEnd) / 2;

                let yMiddle = this.dimensions[1] / 2;
                let textYMiddle = this.dimensions[1] / 2;
                let geneName = geneInfo[3];

                if (geneInfo[5] == '+') {
                    // genes on the + strand drawn above and in blue
                    yMiddle -= 6;
                    textYMiddle -= 10;
                    graphics.lineStyle(1, 0x0000FF, 1);
                } else {
                    // genes on the - strand drawn below and in red
                    yMiddle += 6;
                    textYMiddle += 23;
                    graphics.lineStyle(1, 0xFF0000, 1);
                }

                let height = valueScale(Math.log(+geneInfo[4]));
                let width= height;

                let rectX = this._xScale(txMiddle) - width / 2;
                let rectY = yMiddle - height / 2;

                let xStartPos = this._xScale(txStart);
                let xEndPos = this._xScale(txEnd);


                if (xEndPos - xStartPos > 10)  {
                    this.drawExons(graphics, txStart, txEnd, exonStarts, exonEnds, chrOffset, yMiddle);
                } else {
                    graphics.drawRect(rectX, rectY, width, height);
                }

                if (!ft.texts) {
                    // tile probably hasn't been initialized yet
                    return;

                }
                let text = ft.texts[geneName];

                text.position.x = this._xScale(txMiddle);
                text.position.y = textYMiddle;


                if (!parentInFetched) {
                    text.alpha = 1;

                    allTexts.push({importance: +geneInfo[4], text: text, caption: geneName});
                } else {
                    text.alpha = 0;
                }
            });
        }

        ///console.log('addedIds', addedIds);
        if (allTexts.length > 0) {
            //console.log('addedIds:', addedIds);
            //console.log('captions:', allTexts.map(x => x.caption));
        }
        this.hideOverlaps(allTexts);
    }

    hideOverlaps(allTexts) {
        let allBoxes = [];   // store the bounding boxes of the text objects so we can 
                             // calculate overlaps
        allBoxes = allTexts.map(val => {
            let text = val.text;
            text.updateTransform();
            let b = text.getBounds();
            let box = [b.x, b.y, b.x + b.width, b.y + b.height];

            return box;
        });

        let result = boxIntersect(allBoxes, function(i, j) {
            if (allTexts[i].importance > allTexts[j].importance) {
                //console.log('hiding:', allTexts[j].caption)
                allTexts[j].text.alpha = 0; 
            } else {
                //console.log('hiding:', allTexts[i].caption)
                allTexts[i].text.alpha = 0; 
            }
        });
    }

    setPosition(newPosition) {
        super.setPosition(newPosition);

        this.pMain.position.y = this.position[1];
        this.pMain.position.x = this.position[0];
    }

    zoomed(newXScale, newYScale) {
        this.xScale(newXScale);
        this.yScale(newYScale);
        
        this.refreshTiles();

        this.draw();
    }
}
