import {
  action,
  observable,
  makeObservable
} from "mobx";
import BluetoothDeviceProxy from "../proxies/BluetoothDeviceProxy";

const DISCONNECTED = 0;
const CONNECTING = 1;
const CONNECTED = 2;
const SERVICES_DISCOVERED = 3;

export default class BluetoothContextDeviceProxy {
  constructor(deviceId, createDeviceObject) {
    this.__createDeviceObject = createDeviceObject;
    this.__state = DISCONNECTED;
    
    this.__onConnected = this.__onConnected.bind(this);
    this.__onDisconnected = this.__onDisconnected.bind(this);
    this.__onServicesDiscovered = this.__onServicesDiscovered.bind(this);
    
    this.__createProxy(deviceId);
    
    makeObservable(this, {
      __setState: action,
      __state: observable
    });
  }
  
  get device() {
    return this.__proxy.device;
  }
  
  isConnecting() {
    return this.__state === CONNECTING;
  }
  
  async openConnection() {
    if (this.__proxy.device.isShutdownRequested()) {
      this.__createProxy(this.__proxy.device.getId());
    }
    
    const result = await this.__proxy.device.openConnection();
    
    this.__setState(CONNECTING);
    
    return result;
  }
  
  get raw() {
    return this.__proxy.raw;
  }
  
  get state() {
    return this.__state;
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
    this.__setState(CONNECTED);
  }
  
  __onDisconnected() {
    this.__setState(DISCONNECTED);
  }
  
  __onServicesDiscovered() {
    this.__setState(SERVICES_DISCOVERED);
  }
  
  __setState(state) {
    this.__state = state;
  }
};
