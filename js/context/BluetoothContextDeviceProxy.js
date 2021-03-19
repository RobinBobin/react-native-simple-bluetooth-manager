import { makeAutoObservable } from "mobx";
import BluetoothDeviceProxy from "../proxies/BluetoothDeviceProxy";

const DISCONNECTED = 0;
const CONNECTING = 1;
const CONNECTED = 2;
const SERVICES_DISCOVERED = 3;

export default class BluetoothContextDeviceProxy {
  constructor(deviceId, createDeviceObject) {
    this.__createDeviceObject = createDeviceObject;
    this.__state = DISCONNECTED;
    
    this.__createProxy(deviceId);
    
    makeAutoObservable(this, {
      device: false,
      isConnecting: false,
      raw: false,
      __createDeviceObject: false,
      __createProxy: false,
      __proxy: false
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
    
    this.__state = CONNECTING;
    
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
      .addOnConnectedListener(this.__onConnected.bind(this))
      .addOnDisconnectedListener(this.__onDisconnected.bind(this))
      .addOnServicesDiscoveredListener(this.__onServicesDiscovered.bind(this));
  }
  
  __onConnected() {
    this.__state = CONNECTED;
  }
  
  __onDisconnected() {
    this.__state = DISCONNECTED;
  }
  
  __onServicesDiscovered() {
    this.__state = SERVICES_DISCOVERED;
  }
};
