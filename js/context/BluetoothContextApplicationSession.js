import { ApplicationSession } from "react-native-common-utils";

export default class BluetoothContextApplicationSession extends ApplicationSession {
  _start() {
    for (let selectedDevice of this._context.selectedDevices) {
      if (!this._isShutdownRequested()) {
        selectedDevice.openConnection().catch(console.log);
      }
    }
  }
  
  async _requestShutdown() {
    super._requestShutdown();
    
    let counter = this._context.selectedDevices.length;
    
    for (let selectedDevice of this._context.selectedDevices) {
      selectedDevice.device.shutdown()
        .catch(console.log)
        .then(() => --counter);
    }
    
    while (counter) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this._setShutdown();
  }
};

BluetoothContextApplicationSession._setSessionType(BluetoothContextApplicationSession, true);
