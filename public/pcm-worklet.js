class CapturePCM extends AudioWorkletProcessor {
  process(inputs) {
    const channel=inputs[0]?.[0];
    if(channel)this.port.postMessage(channel.slice());
    return true;
  }
}
registerProcessor('capture-pcm',CapturePCM);
