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
  __listeners = [];
  __maxDeviceCountToStore = -1;
  __scanMillis = 5000;
  __scanMinMillis = 2000;
  __scanOptions = {};
  __scanStarted = false;
  
  constructor() {
    this.__listeners.push(emitter.addListener(
      bt.events.leScanCallback.SCAN_FAILED,
      this.__onScanFailed.bind(this)));
    
    this.__listeners.push(this.addOnScanResultListener(this.__onScanResult.bind(this)));
  }
  
  addOnScanResultListener(listener) {
    return emitter.addListener(bt.events.leScanCallback.SCAN_RESULT, listener);
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
        
        while (
          this.__scanStarted
          && !timeoutFired
          && (this.__maxDeviceCountToStore > this.__discoveredDevices.length))
        {
          await new Promise(r => setTimeout(r, 100));
        }
        
        resolve();
      }));
    }
    
    if (promises.length) {
      promises.push(new Promise(async resolve => {
        while (this.__scanStarted) {
          await new Promise(r => setTimeout(r, 100));
        }
        
        resolve();
      }));
      
      await Promise.race(promises);
      
      if (await this.stopScan()) {
        return this.getDiscoveredDevices();
      }
    }
  }
  
  async stopScan(throwIfStopped) {
    let result = true;
    
    if (!this.__scanStarted) {
      if (throwIfStopped) {
        throw new Error("Scan already stopped");
      }
      
      result = false;
    }
    
    if (result) {
      await bt.stopScan();
      
      this.__scanStarted = false;
    }
    
    return result;
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
