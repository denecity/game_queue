// Lets the phone's back button (and the browser back button) close the topmost sheet
// instead of leaving the app. Each open sheet pushes a history entry and registers a closer.
interface Entry { close: () => void; pushed: boolean }

const stack: Entry[] = []
let ignorePops = 0
// history.back() is async; a pushState issued before its popstate lands would get popped
// instead, so pushes wait until our own pending backs have settled.
const waitingPushes: Entry[] = []

function push(entry: Entry) {
  history.pushState({ gqSheet: true }, '')
  entry.pushed = true
}

window.addEventListener('popstate', () => {
  if (ignorePops > 0) {
    if (--ignorePops === 0) waitingPushes.splice(0).forEach(push)
    return
  }
  stack.pop()?.close()
})

export function pushBack(close: () => void): () => void {
  const entry: Entry = { close, pushed: false }
  stack.push(entry)
  if (ignorePops > 0) waitingPushes.push(entry)
  else push(entry)

  let released = false
  // Call when the sheet closes by other means (button, backdrop) to drop its history entry
  return () => {
    if (released) return
    released = true
    const i = stack.indexOf(entry)
    if (i === -1) return // already popped by the back button
    stack.splice(i, 1)
    if (entry.pushed) {
      ignorePops++
      history.back()
    } else {
      waitingPushes.splice(waitingPushes.indexOf(entry), 1)
    }
  }
}

// Escape closes the topmost sheet the same way the back button does
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && stack.length && ignorePops === 0) history.back()
})
