// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { attachMessageThreadDragScroll } from './message-thread-scroll'

function scrollerWith(child: HTMLElement) {
  const scroller = document.createElement('div')
  let top = 80
  Object.defineProperty(scroller, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (value: number) => {
      top = value
    },
  })
  scroller.append(child)
  document.body.append(scroller)
  return scroller
}

function drag(
  target: Element,
  fromY: number,
  toY: number,
  pointerType = 'mouse',
) {
  const init = {
    bubbles: true,
    pointerId: 1,
    pointerType,
    button: 0,
    clientX: 20,
    clientY: fromY,
  }
  target.dispatchEvent(new PointerEvent('pointerdown', init))
  target.dispatchEvent(
    new PointerEvent('pointermove', { ...init, clientY: toY }),
  )
  target.dispatchEvent(new PointerEvent('pointerup', { ...init, clientY: toY }))
  target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('message thread drag scroll', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('scrolls when a drag starts on a photo or log entry', () => {
    const photo = document.createElement('img')
    const scroller = scrollerWith(photo)
    const cleanup = attachMessageThreadDragScroll(scroller)
    drag(photo, 200, 120)
    expect(scroller.scrollTop).toBe(160)
    const logEntry = document.createElement('button')
    scroller.append(logEntry)
    drag(logEntry, 200, 140)
    expect(scroller.scrollTop).toBe(220)
    cleanup()
  })

  it('keeps a tap on the entry', () => {
    const logEntry = document.createElement('button')
    let clicks = 0
    logEntry.addEventListener('click', () => {
      clicks += 1
    })
    const scroller = scrollerWith(logEntry)
    const cleanup = attachMessageThreadDragScroll(scroller)
    drag(logEntry, 200, 198)
    expect(clicks).toBe(1)
    expect(scroller.scrollTop).toBe(80)
    cleanup()
  })

  it('does not open the photo after a drag', () => {
    const photo = document.createElement('a')
    let clicks = 0
    photo.addEventListener('click', () => {
      clicks += 1
    })
    const scroller = scrollerWith(photo)
    const cleanup = attachMessageThreadDragScroll(scroller)
    drag(photo, 200, 100)
    expect(clicks).toBe(0)
    cleanup()
  })

  it('leaves map and video drags alone', () => {
    const map = document.createElement('div')
    map.className = 'maplibregl-map'
    const canvas = document.createElement('canvas')
    map.append(canvas)
    const scroller = scrollerWith(map)
    const cleanup = attachMessageThreadDragScroll(scroller)
    drag(canvas, 200, 80)
    expect(scroller.scrollTop).toBe(80)
    cleanup()
  })

  it('leaves a touch drag alone when the browser scrolls', async () => {
    const photo = document.createElement('img')
    const scroller = scrollerWith(photo)
    const cleanup = attachMessageThreadDragScroll(scroller)
    let simulatedNative = false
    scroller.addEventListener('pointermove', () => {
      if (simulatedNative) return
      simulatedNative = true
      scroller.scrollTop = 110
    })
    photo.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        pointerId: 1,
        pointerType: 'touch',
        button: 0,
        clientX: 20,
        clientY: 200,
      }),
    )
    photo.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        pointerId: 1,
        pointerType: 'touch',
        clientX: 20,
        clientY: 80,
      }),
    )
    await new Promise((resolve) => requestAnimationFrame(resolve))
    photo.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        pointerId: 1,
        pointerType: 'touch',
        clientX: 20,
        clientY: 40,
      }),
    )
    expect(scroller.scrollTop).toBe(110)
    cleanup()
  })

  it('scrolls a touch drag when the browser does not', async () => {
    const photo = document.createElement('img')
    const scroller = scrollerWith(photo)
    const cleanup = attachMessageThreadDragScroll(scroller)
    photo.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        pointerId: 1,
        pointerType: 'touch',
        button: 0,
        clientX: 20,
        clientY: 200,
      }),
    )
    photo.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        pointerId: 1,
        pointerType: 'touch',
        clientX: 20,
        clientY: 120,
      }),
    )
    expect(scroller.scrollTop).toBe(80)
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(scroller.scrollTop).toBe(160)
    cleanup()
  })
})
