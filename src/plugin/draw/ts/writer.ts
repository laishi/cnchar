import HanziWriter from './hanzi-writer';
import {TYPE, merge, TEST_STATUS} from './default-option';
import {pickCnChar} from './util';
import {buildLinesStr} from './line';
import {stroke} from './stroke';
import {IWriter, IWriterOption} from './types/index';
import {
    TDrawType,
    IDrawOption,
    IDrawStyleOption,
    IDrawAnimationOption,
    IDrawLineOption,
    IDrawTestOption,
    IDrawStrokeOption,
    IBuildLineStr,
    ICloneSvg,
    IDraw
} from './types/common';

const document = (typeof window === 'object') ? (window.document || null) : null;

const svg = (() => {
    if (!document) {
        return null;
    }
    return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
})();

export class Writer implements IWriter {
    option: IDrawOption;
    el: HTMLElement;
    type: TDrawType;
    text: Array<string>;
    writers: Array<HanziWriter>;
    animateStart: () => void;
    constructor ({
        el = 'cnchar-draw',
        text = '',
        clear = true,
        type = TYPE.NORMAL,
        style = {},
        line = {},
        animation = {},
        stroke = {},
        test = {},
    }: IWriterOption) {
        this.type = type;
        this.writers = [];
        this.text = text.split('');
        const opts: {
            style: IDrawStyleOption;
            line: IDrawLineOption;
            animation?: IDrawAnimationOption;
            test?: IDrawTestOption;
            stroke?: IDrawStrokeOption;
        } = {style, line};
        switch (type) {
            case TYPE.ANIMATION: opts.animation = animation; break;
            case TYPE.STROKE: opts.stroke = stroke; break;
            case TYPE.TEST: opts.test = test; break;
        }
        this.option = merge(type, opts);
        if (typeof el === 'string') {
            this.el = document.querySelector(el) || document.body;
        } else {
            this.el = el;
        }
        if (this.el && clear) {
            this.el.innerHTML = '';
        }
        if (!this.el) {
            this.el = document.createElement('div');
            document.body.appendChild(this.el);
        }
        this.init();
    }
    init (): void {
        const {lineHTML, border} = buildLinesStr(this.option as IBuildLineStr);
        const cloneSvg: ICloneSvg = (option: IDrawOption) => {
            const node = svg.cloneNode() as HTMLElement;
            node.setAttribute('width', this.option.width.toString());
            node.setAttribute('height', this.option.height.toString());
            if (border) {
                node.style.border = border;
            }
            if (lineHTML) {
                node.innerHTML = lineHTML;
            }
            if (option.backgroundColor) {
                node.style.backgroundColor = option.backgroundColor;
            }
            return node;
        };
        if (this.type === TYPE.STROKE) {
            stroke(this, cloneSvg);
        } else {
            this.text.forEach((v) => {
                const node = cloneSvg(this.option);
                this.writers.push(HanziWriter.create(node, v, this.option));
                this.el.appendChild(node);
            });
            if (this.type === TYPE.ANIMATION) {
                let isStart = false;
                this.animateStart = () => {
                    if (isStart) {
                        return;
                    }
                    isStart = true;
                    if (this.option.loopAnimate) {
                        this.loopAnimate();
                    } else {
                        this.animate(this.option.animateComplete);
                    }
                };
                if (this.option.autoAnimate) {
                    this.animateStart();
                } else {
                    const start = () => {
                        this.animateStart();
                        this.el.removeEventListener('click', start, false);
                    };
                    this.el.addEventListener('click', start, false);
                }
            } else if (this.type === TYPE.TEST) {
                let opt: Function;
                const fn = this.option.onTestStatus;
                if (typeof fn === 'function') {
                    opt = (index: number) => {
                        return {
                            onMistake (strokeData) {
                                fn({index, status: TEST_STATUS.MISTAKE, data: strokeData});
                            },
                            onCorrectStroke (strokeData) {
                                fn({index, status: TEST_STATUS.CORRECT, data: strokeData});
                            },
                            onComplete (summaryData) {
                                fn({index, status: TEST_STATUS.COMPLETE, data: summaryData});
                            }
                        };
                    };
                } else {
                    opt = () => {return {};};
                }
                this.writers.forEach((writer, index) => {
                    writer.quiz(opt(index));
                });
            }
        }
    }
    animate (complete: Function) {
        const opt = this.option;
        if (opt.stepByStep) { // 汉字之间连续绘制
            if (opt.showCharacter === false) {
                this.writers.forEach(writer => {
                    writer.hideCharacter();
                });
            }
            this._animateStep(0, complete);
        } else { // 汉字一起绘制，笔画最多的绘制完成才算全部绘制完成
            let index = 0;
            for (let i = 0; i < this.writers.length; i++) {
                this._animateSingle(i, () => {
                    index++;
                    if (index === this.writers.length) {
                        complete();
                    }
                });
            }
        }
    }
    loopAnimate () {
        const opt = this.option;
        this.animate(() => {
            opt.animateComplete();
            setTimeout(() => {
                this.loopAnimate();
            }, opt.delayBetweenStrokes);
        });
    }
    // animate单个汉字
    _animateSingle (index: number, complete: Function): void {
        if (index >= this.writers.length) {
            complete(true);
            return;
        }
        this.writers[index].animateCharacter({
            onComplete: () => {
                complete(false);
            }
        });
    }
    _animateStep (index: number, complete: Function): void {
        this._animateSingle(index, (end) => {
            if (!end) {
                setTimeout(() => {
                    this._animateStep(index + 1, complete);
                }, this.option.delayBetweenStrokes);
            } else {
                complete();
            }
        });
    }
}

const draw: IDraw = (text: string = '', options: IDrawOption = {}): IWriter => {
    if (typeof window === 'undefined') {
        console.error('Draw 方法仅支持在浏览器环境下使用');
        return null;
    }
    text = pickCnChar(text);
    if (!text) {
        throw new Error('Draw 方法text必须含有中文');
    }
    options.text = text;
    return new Writer(options);
};

draw.TYPE = TYPE;
draw.TEST_STATUS = TEST_STATUS;
draw.init = null;

export default draw;