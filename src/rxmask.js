export default class Parser {
    constructor() {
        this.mask = '';
        this.placeholderSymbol = '';
        this.rxmask = [];
        this.allowedCharacters = '.';
        this.showMask = 0;
        this.value = '';
        this.cursorPos = 0;
        // Private properties
        this._output = '';
        this._prevValue = '';
        this._diff = 0;
        this._actualCursorPos = 0;
    }
    get output() {
        return this._output;
    }
    parseMask() {
        if (this.rxmask.length === 0) {
            this.rxmask = this.mask.split('').map(char => {
                if (char === this.placeholderSymbol)
                    return '[^]';
                return char;
            });
        }
        const noMaskValue = this.parseOutMask();
        const parsedValue = this.parseAllowedValue(noMaskValue);
        this._output = this.getOutput(parsedValue, this.cursorPos);
        this._prevValue = this._output;
    }
    // Idea here is to parse everything before cursor position as is,
    // but parse everything after cursor as if it was shifted by inserting some symbols on cursor position.
    // This method is trying to remove mask symbols, but it still leaves symbols that are not allowed
    // TODO: Add example
    parseOutMask() {
        // Get length diff between old and current value
        const diff = this.value.length - this._prevValue.length;
        this._diff = diff;
        // Get value before cursor without mask symbols
        let beforeCursor = '';
        for (let i = 0; i < this.value.length; i++) {
            if (this.value[i] !== this.rxmask[i] && this.value[i] !== this.placeholderSymbol && i < this.cursorPos) {
                beforeCursor += this.value[i];
            }
        }
        // Get value after cursor without mask symbols
        let afterCursor = '';
        for (let i = 0; i < this.value.length - this.cursorPos; i++) {
            // Diff used here to "shift" mask to position where it supposed to be
            if (this.value[i + this.cursorPos] !== this.rxmask[i + this.cursorPos - diff] &&
                this.value[i + this.cursorPos] !== this.placeholderSymbol) {
                afterCursor += this.value[i + this.cursorPos];
            }
        }
        this._actualCursorPos = beforeCursor.length; // it holds position of cursor after input was parsed
        return beforeCursor + afterCursor;
    }
    parseAllowedValue([...noMaskValue]) {
        let parsedValue = '';
        const rxmask = this.rxmask.filter(pattern => pattern.match(/\[.*\]/));
        let i = 0;
        while (noMaskValue.length > 0 && i < noMaskValue.length) {
            if (noMaskValue[i].match(this.allowedCharacters) && noMaskValue[i].match(new RegExp(rxmask[i]))) {
                parsedValue += noMaskValue[i];
                i++;
            }
            else if (noMaskValue[i].match(this.allowedCharacters)) {
                noMaskValue.shift();
                if (this._actualCursorPos > i)
                    this._actualCursorPos--;
            }
            else {
                noMaskValue.shift();
                // This line returns cursor to appropriate position according to removed elements
                this._actualCursorPos--;
            }
        }
        return parsedValue;
    }
    getOutput([...parsedValue], prevCursorPos) {
        this.cursorPos = 0; // We don't need initial cursorPos anymore
        let output = '';
        const parsedValueEmpty = parsedValue.length === 0;
        let encounteredPlaceholder = false; // stores if loop found a placeholder at least once
        for (let i = 0; i < this.rxmask.length; i++) {
            // This condition checks if placeholder was found
            if (this.rxmask[i].match(/\[.*\]/)) {
                if (parsedValue.length > 0) {
                    output += parsedValue.shift();
                }
                else if (this.showMask > i) {
                    output += this.placeholderSymbol;
                    encounteredPlaceholder = true;
                }
                else {
                    break;
                }
                if (this._actualCursorPos > 0)
                    this.cursorPos++;
                this._actualCursorPos--; // reduce this because one symbol or placeholder was added
            }
            else {
                // Add mask symbol if
                if (
                // mask is not fully shown according to this.showMask
                this.showMask > i ||
                    // or there's some parsed characters left to add
                    parsedValue.length > 0 ||
                    // or this mask symbol is following parsedValue character and user just added symbols (not removed)
                    // (example - If with mask ***--**-** user types 123, user will get 123--, but if he removes symbol 4 from 123--4, he will get just 123 without -)
                    (!encounteredPlaceholder && this._diff >= 0)) {
                    output += this.rxmask[i];
                }
                else {
                    break;
                }
                // Add 1 to cursorPos if
                if (
                // no placeholder was encountered, parsedValue is empty and this mask symbol should be shown
                // (this ensures that cursor position will be always set just before first placeholder if parsedValue is empty)
                (!encounteredPlaceholder && parsedValueEmpty && this.showMask > i) ||
                    // or according to _actualCursorPos not all characters from parsedValue before cursorPos were added yet
                    this._actualCursorPos > 0 ||
                    // or all characters from parsedValue before cursorPos were added, but no placeholders yet (or it will be negative) and user just added symbols (see example above)
                    (this._actualCursorPos === 0 && this._diff >= 0)) {
                    this.cursorPos++;
                }
            }
        }
        // Stop user from adding symbols after mask is completed
        if (parsedValue.length > 0) {
            this.cursorPos = prevCursorPos - this._diff;
            return this._prevValue;
        }
        return output;
    }
}
// Currently unused, parses string and escapes any character that is special to RegExp
// function regexLiteral(str: string) {
//   return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// }
(function processInputs() {
    const DOMInputs = document.getElementsByClassName('rxmask');
    for (let i = 0; i < DOMInputs.length; i++) {
        const input = DOMInputs[i];
        const parser = new Parser();
        // Call it first time to parse all params and apply visible part of mask
        onInput(input, parser);
        // Add event
        input.oninput = () => onInput(input, parser);
    }
})();
export function onInput(input, parser) {
    // Assign params every time in case it changes on the fly
    parser.mask = input.getAttribute('mask') || '';
    parser.placeholderSymbol = input.getAttribute('placeholderSymbol') || '*';
    parser.rxmask = (input.getAttribute('rxmask') || '').match(/(\[.*?\])|(.)/g) || [];
    parser.allowedCharacters = input.getAttribute('allowedCharacters') || '.';
    parser.showMask = input.getAttribute('showMask') === 'true' ? Infinity : Number(input.getAttribute('showMask'));
    parser.value = input.value;
    parser.cursorPos = input.selectionStart;
    // Call parser
    parser.parseMask();
    // Everything is parsed, set output and cursorPos
    input.value = parser.output;
    input.setSelectionRange(parser.cursorPos, parser.cursorPos);
}
