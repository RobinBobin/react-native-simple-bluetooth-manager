import { makeAutoObservable } from "mobx";
import BluetoothContextDeviceProxy from "./BluetoothContextDeviceProxy";

export default class BluetoothContext {
  bluetooth;
  discoveredDevices = [];
  selectedDevices = [];
  
  constructor(bluetooth, createDeviceObject) {
    this.bluetooth = bluetooth;
    this.__createDeviceObject = createDeviceObject;
    
    makeAutoObservable(this, {
      bluetooth: false,
      __createDeviceObject: false
    });
  }
  
  addSelectedDevice(deviceId, createDeviceObject) {
    const device = new BluetoothContextDeviceProxy(deviceId, createDeviceObject ?? this.__createDeviceObject);
    
    this.selectedDevices.push(device);
    
    this.selectedDevices = [...this.selectedDevices];
    
    return device;
  }
  
  removeSelectedDevice(index) {
    this.selectedDevices.splice(index, 1);
    
    this.selectedDevices = [...this.selectedDevices];
  }
  
  setDiscoveredDevices(discoveredDevices) {
    this.discoveredDevices = discoveredDevices;
  }
};
