import {
  action,
  observable,
  makeObservable
} from "mobx";
import BluetoothDeviceProxy from "../proxies/BluetoothDeviceProxy";

export default class BluetoothContextDeviceProxy {
  constructor(deviceId, createDeviceObject) {
    this.__createDeviceObject = createDeviceObject;
    this.__stateTrigger = false;
    
    this.__onConnected = this.__onConnected.bind(this);
    this.__onDisconnected = this.__onDisconnected.bind(this);
    this.__onServicesDiscovered = this.__onServicesDiscovered.bind(this);
    
    this.__createProxy(deviceId);
    
    makeObservable(this, {
      __stateTrigger: observable,
      __toggleStateTrigger: action
    });
  }
  
  areServicesDiscovered() {
    const _ = this.__stateTrigger;
    
    return this.__proxy.device.areServicesDiscovered();
  }
  
  isConnected() {
    const _ = this.__stateTrigger;
    
    return this.__proxy.device.isConnected();
  }
  
  async openConnection() {
    if (this.__proxy.device.isShutdownRequested()) {
      this.__createProxy(this.__proxy.device.getId());
    }
    
    return await this.__proxy.device.openConnection();
  }
  
  get proxy() {
    return this.__proxy;
  }
  
  __createProxy(deviceId) {
    const object = this.__createDeviceObject(deviceId);
    
    this.__proxy = object instanceof BluetoothDeviceProxy ? object : new BluetoothDeviceProxy(object);
    
    this.__proxy.device
      .addOnConnectedListener(this.__onConnected)
      .addOnDisconnectedListener(this.__onDisconnected)
      .addOnServicesDiscoveredListener(this.__onServicesDiscovered);
  }
  
  __onConnected() {
    this.__toggleStateTrigger();
  }
  
  __onDisconnected() {
    this.__toggleStateTrigger();
  }
  
  __onServicesDiscovered() {
    this.__toggleStateTrigger();
  }
  
  __toggleStateTrigger() {
    this.__stateTrigger ^= true;
  }
};
