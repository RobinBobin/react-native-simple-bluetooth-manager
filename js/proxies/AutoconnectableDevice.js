import BluetoothDeviceProxy from "./BluetoothDeviceProxy";

export default class AutoconnectableDevice extends BluetoothDeviceProxy {
  constructor(object) {
    super(object);
    
    this.device.addOnDisconnectedListener(this.__onDisconnected.bind(this));
  }
  
  __onDisconnected() {
    this.device.openConnection().catch(console.log);
  }
};
