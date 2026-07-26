import { hub } from '../utils/hub'

// player/GM websocket: hello attaches, submit forwards
export default defineWebSocketHandler({
  open() {}, // wait for hello
  message(peer, message) {
    let msg: any
    try { msg = JSON.parse(message.text()) } catch { return }
    if (msg.type === 'hello') hub.attach(Number(msg.id), peer)
    else if (msg.type === 'submit') hub.submitByPeer(peer, msg.payload)
  },
  close(peer) { hub.detach(peer) },
})
