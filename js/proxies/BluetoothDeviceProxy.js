import BluetoothDevice from "../BluetoothDevice";
import BluetoothDeviceQueue from "../BluetoothDeviceQueue";

export default class BluetoothDeviceProxy {
  constructor(object) {
    this.__device = object.constructor === BluetoothDevice ? object
      : object.constructor === BluetoothDeviceQueue ? object.device
      : object.constructor === BluetoothDeviceProxy ? object.device
      : null;
    
    if (!this.__device) {
      throw new Error("Unknown object type");
    }
    
    this.__raw = object;
  }
  
  get device() {
    return this.__device;
  }
  
  get raw() {
    return this.__raw;
  }
};
