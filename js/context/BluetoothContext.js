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
    this.selectedDevices.push(new BluetoothContextDeviceProxy(deviceId, createDeviceObject ?? this.__createDeviceObject));
    
    this.selectedDevices = [...this.selectedDevices];
  }
  
  removeSelectedDevice(index) {
    this.selectedDevices.splice(index, 1);
    
    this.selectedDevices = [...this.selectedDevices];
  }
  
  setDiscoveredDevices(discoveredDevices) {
    this.discoveredDevices = discoveredDevices;
  }
};
