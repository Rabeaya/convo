/**
 * HTML truncation utilities
 *
 * Strictly mirrors AngularJS:
 * - utils.truncateHtmlString
 * - filter('limitHtmlText')
 */
export function truncateHtmlString(
  htmlStr: string,
  numCharsToTruncate: number = 1,
  charsToTruncate: string = ''
): { idx: number; htmlStr: string } {
  let str = htmlStr || '';
  let n = numCharsToTruncate || 1;
  const chars = charsToTruncate || '';

  let idx = str.length - 1;
  if (str === '' || n < 1) {
    return { idx: 0, htmlStr: str };
  }

  let currState: 'begin' | '<' | '>' = 'begin';

  while (true) {
    const currChar = str.charAt(idx);

    if (currChar === '<') {
      currState = '<';
    } else if (currChar === '>') {
      currState = '>';
    } else if (currState !== '>' && (currState === '<' || currState === 'begin')) {
      let doTruncate = true;
      if (chars.length > 0 && chars.indexOf(str.charAt(idx)) === -1) {
        doTruncate = false;
      }
      if (doTruncate) {
        str = str.substring(0, idx) + str.substr(idx + 1);
      }
      n--;
    }

    idx--;
    if (idx === -1 || n === 0) break;
  }

  return { idx: idx + 1, htmlStr: str };
}

export function limitHtmlText(
  htmlStr: string,
  limitTo: number,
  returnObj: boolean = false
): { isTruncated: boolean; htmlStr: string; fullText: string } | string {
  const res = {
    isTruncated: false,
    htmlStr: htmlStr,
    fullText: '',
  };

  if (htmlStr && limitTo > 0) {
    const div = document.createElement('div');
    div.innerHTML = htmlStr;
    res.fullText = div.innerText;

    if (res.fullText && res.fullText.length > limitTo) {
      const r = truncateHtmlString(htmlStr, res.fullText.length - limitTo);
      res.htmlStr = (r.htmlStr.substring(0, r.idx) + '...' + r.htmlStr.substring(r.idx))
        .replace(/^((<br>)|(<br \/>)|(<br >)|(<br\/>))*|((<br>)|(<br \/>)|(<br >)(<br\/>))*$/g, '')
        .replace(/^(<br>)*|(<br\/>)*$/g, '')
        .replace(/<p><br><\/p>/g, '')
        .replace(/<(div|em|p|strong)[^>]*>\s*<\/(div|em|p|strong)>/g, '');
      res.isTruncated = true;
    }
  }

  return returnObj ? res : res.htmlStr;
}


