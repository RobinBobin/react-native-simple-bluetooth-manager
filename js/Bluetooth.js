import {
  NativeModules,
  NativeEventEmitter
} from "react-native";
import { StaticUtils } from "react-native-common-utils";

const bt = NativeModules.SimpleBluetoothManager;
const emitter = new NativeEventEmitter(bt);

export default class Bluetooth {
  static scanMode = bt.scanMode;
  
  __allowDuplicates = false;
  __discoveredDevices = [];
  __listeners;
  __maxDeviceCountToStore = -1;
  __scanMillis = 5000;
  __scanMinMillis = 2000;
  __scanOptions = {};
  __scanStarted = false;
  
  constructor() {
    this.__listeners = [
      [ bt.events.leScanCallback.SCAN_RESULT, this.__onScanResult.bind(this)],
      [ bt.events.leScanCallback.SCAN_FAILED, this.__onScanFailed.bind(this)]
    ].map(data => emitter.addListener(data[0], data[1]));
  }
  
  getDiscoveredDevices() {
    return [...this.__discoveredDevices];
  }
  
  isEnabled() {
    return bt.isEnabled();
  }
  
  isKnownDeviceId(id) {
    return StaticUtils.isIOS() && bt.isKnownDeviceId(id);
  }
  
  isScanStarted() {
    return this.__scanStarted;
  }
  
  removeAllListeners() {
    this.__listeners.forEach(listener => listener.remove());
  }
  
  setCommonScanOptions(deviceName, scanMode = Bluetooth.scanMode.LOW_LATENCY) {
    this.setScanOptions({
      filters: [{deviceName}],
      settings: {scanMode}
    });
  }
  
  setMaxDeviceCountToStore(maxDeviceCountToStore) {
    this.__maxDeviceCountToStore = maxDeviceCountToStore;
  }
  
  setScanMillis(scanMillis) {
    this.__scanMillis = scanMillis < 0 ? scanMillis : Math.max(scanMillis, this.__scanMinMillis);
  }
  
  setScanMinMillis(scanMinMillis) {
    this.__scanMinMillis = scanMinMillis;
  }
  
  setScanOptions(scanOptions) {
    this.__scanOptions = scanOptions;
  }
  
  async startScan() {
    if (this.__scanStarted) {
      throw new Error("Scan already started");
    }
    
    this.__discoveredDevices = [];
    
    await bt.startScan(this.__scanOptions);
    
    this.__scanStarted = true;
    
    const promises = [];
    let timeoutFired = false;
    
    if (this.__scanMillis > 0) {
      promises.push(new Promise(resolve => setTimeout(() => {
        timeoutFired = true;
        resolve();
      }, this.__scanMillis)));
    }
    
    if (this.__maxDeviceCountToStore > 0) {
      promises.push(new Promise(async resolve => {
        await new Promise(r => setTimeout(r, this.__scanMinMillis));
        
        while (!timeoutFired && (this.__maxDeviceCountToStore > this.__discoveredDevices.length)) {
          await new Promise(r => setTimeout(r, 100));
        }
        
        resolve();
      }));
    }
    
    if (promises.length) {
      await Promise.race(promises);
      
      if (this.__scanStarted) {
        await this.stopScan();
      }
    }
  }
  
  async stopScan() {
    if (!this.__scanStarted) {
      throw new Error("Scan already stopped");
    }
    
    await bt.stopScan();
    
    this.__scanStarted = false;
  }
  
  __onScanFailed(data) {
    console.log("Bluetooth._onScanFailed()", JSON.stringify(data));
  }
  
  __onScanResult(data) {
    for (let result of data.results) {
      if (this.__discoveredDevices.length === this.__maxDeviceCountToStore) {
        break;
      }
      
      if (this.__allowDuplicates || !this.__discoveredDevices.find(scanResult => scanResult.device.id === result.device.id)) {
        this.__discoveredDevices.push(result);
      }
    }
  }
}
