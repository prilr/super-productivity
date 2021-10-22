import {
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { IS_FIREFOX } from '../../util/is-firefox';

// HELPER
// -----------------------------------

@Directive({
  selector: '[contentEditableOnClick]',
})
export class ContentEditableOnClickDirective implements OnInit, OnDestroy {
  @Input() isResetAfterEdit: boolean = false;
  @Output() editFinished: EventEmitter<{
    isChanged: boolean;
    newVal: string;
    $taskEl: HTMLElement | null;
    event: Event;
  }> = new EventEmitter();
  private _lastDomValue: string | undefined;
  private _lastOutsideVal: string | undefined;
  private readonly _el: HTMLElement;
  private _redrawTimeout: number | undefined;

  constructor(el: ElementRef) {
    this._el = el.nativeElement;
  }

  private _value: string | undefined;

  @Input() set value(_val: string) {
    this._value = this._lastOutsideVal = _val;
    // also update last dom value because that's how check for changes
    this._lastDomValue = _val;
    this._refreshView();
  }

  ngOnInit(): void {
    const el = this._el;

    if (el.getAttribute('contenteditable') === null) {
      el.setAttribute('contenteditable', 'true');
    }

    // TODO move all ato host listener
    el.addEventListener('focus', (ev: Event) => {
      // setTimeout(() => {
      //   document.execCommand('selectAll', false, null);
      // });
      this._moveCursorToEndForKeyboardFocus();

      window.clearTimeout(this._redrawTimeout);
      // this fixes the bug where the text is not visible for some time
      // by triggering a redraw via el.offsetHeight
      // this._redrawTimeout = window.setTimeout(() => this._el.offsetHeight, 30);
    });

    el.addEventListener('input', (ev) => {
      this._setValueFromElement();

      // this fixes the bug where the text is not visible for some time
      // by triggering a redraw via el.offsetHeight
      // eslint-disable-next-line
      this._el.offsetHeight;
    });

    el.addEventListener('blur', (ev) => {
      this._setValueFromElement();
      this._onEditDone(ev);
    });

    // prevent keyboard shortcuts from firing when here
    el.addEventListener('keydown', (ev: KeyboardEvent) => {
      ev.stopPropagation();
      // blur on escape
      if (ev.key === 'Enter' || ev.key === 'Escape') {
        ev.preventDefault();
        setTimeout(() => {
          el.blur();
        });
      }
    });

    // blur on enter
    el.addEventListener('keypress', (ev: KeyboardEvent) => {
      if (ev.key === 'Enter') {
        // prevent keyboard shortcuts from firing when here
        ev.preventDefault();
        setTimeout(() => {
          el.blur();
        });
      }
    });

    el.onpaste = (ev: ClipboardEvent) => {
      const data = ev.clipboardData !== null && ev.clipboardData.getData('text/plain');
      if (data && data.length) {
        ev.stopPropagation();
        ev.preventDefault();
        const text = data.trim();
        this._insertAtCursor(el, text);
        this._setValueFromElement();
      }
    };
  }

  ngOnDestroy(): void {
    window.clearTimeout(this._redrawTimeout);
  }

  private _refreshView(): void {
    this._el.innerText = this._value || '';
  }

  private _onEditDone(event: Event): void {
    // deselect all text
    const sel = window.getSelection();
    if (sel !== null) {
      sel.removeAllRanges();
    }

    const curVal = this._el.innerText;
    const isChanged = this._lastDomValue !== curVal;
    this._lastDomValue = curVal;

    this.editFinished.emit({
      isChanged,
      newVal: curVal,
      $taskEl: this._el.closest('.task'),
      event,
    });

    if (this.isResetAfterEdit) {
      this._value = this._lastOutsideVal;
      this._refreshView();
    }
  }

  private _setValueFromElement(): void {
    this._value = this._removeTags(this._el.innerText);
  }

  private _insertAtCursor(el: HTMLElement, newText: string): void {
    const sel = window.getSelection();
    if (sel === null) {
      return;
    }

    const text = el.innerText;

    const auxilixarInformation = this._calculateStartAndEnd(
      sel.anchorOffset,
      sel.focusOffset,
      sel.anchorNode,
      el,
      text.length,
    );
    const start = auxilixarInformation.start;
    const end = auxilixarInformation.end;
    const indexNode = auxilixarInformation.index;

    const textBefore = text.substring(0, start);
    const textAfter = text.substring(end, text.length);

    // reset caret to proper offset
    const range = document.createRange();
    // it is not the chrome browser, then to do a different way of adding the new text
    // otherwise, doing the setStart command
    if (IS_FIREFOX) {
      el.innerText = (textBefore + newText + textAfter).trim();
      range.setStartAfter(el.childNodes[indexNode]);
    } else {
      el.innerText = (textBefore + newText + textAfter).trim();
      range.setStart(el.childNodes[0], start + newText.length);
    }
    range.collapse(true);

    const sel2 = window.getSelection();
    if (sel2 !== null) {
      sel2.removeAllRanges();
      sel2.addRange(range);
    }
  }

  /**
   * Function that calculates the value of the start and the value of the end position
   * to build the text for the selected element.
   */
  private _calculateStartAndEnd(
    initialStart: number,
    initialEnd: number,
    selectedNode: Node | null,
    el: HTMLElement,
    sizeText: number,
  ): any {
    let auxiliarInformation = {
      start: initialStart,
      end: initialEnd,
      index: 0,
    };
    let forSave = 0; // the childNode index

    // sometimes, the selected node is not the first one, and the new text will add in the wrong place.
    // so, it is needed to check what is the correct selected node before doing the rest of the code
    if (el.childNodes.length > 1 && IS_FIREFOX) {
      let untilNode = 0;
      el.childNodes.forEach((item, index) => {
        if (!selectedNode?.isSameNode(item)) {
          untilNode += item.nodeValue ? item.nodeValue.length : untilNode;
        } else {
          if (index !== 0) {
            auxiliarInformation.start = auxiliarInformation.start + untilNode;
            auxiliarInformation.end = auxiliarInformation.end + untilNode;
            forSave = index;
          }
        }
      });
    }
    if (auxiliarInformation.start > sizeText) {
      auxiliarInformation.start = sizeText;
    }
    if (auxiliarInformation.end > sizeText) {
      auxiliarInformation.end = sizeText;
    }
    return auxiliarInformation;
  }

  private _removeTags(str: string): string {
    return str
      .replace(/<\/?[^`]+?\/?>/gim, '\n') // replace all tags
      .replace(/\n/gim, '') // replace line breaks
      .replace(/&nbsp;/gim, '') // replace line breaks
      .replace('&nbsp;', '') // replace line breaks again because sometimes it doesn't work
      .trim();
  }

  private _moveCursorToEndForKeyboardFocus(): void {
    // NOTE: keep in mind that we're in a contenteditable
    try {
      const sel = document.getSelection();
      if (sel !== null) {
        // only execute for focus via keyboard
        if (sel.focusNode) {
          document.execCommand('selectAll', false, undefined);
          sel.collapseToEnd();
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
}
