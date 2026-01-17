import { EventEmitter } from 'events'

let lastOrderTime: Date | null = null

export const orderEmitter = new EventEmitter()
orderEmitter.setMaxListeners(100)

orderEmitter.on('order', () => {
  lastOrderTime = new Date()
})

export function getLastOrderTime(): Date | null {
  return lastOrderTime
}
