import {
   NativeModules,
   NativeEventEmitter,
   Platform
} from "react-native";

const bt = NativeModules.SimpleBluetoothManager;
const emitter = new NativeEventEmitter(bt);

export default class Bluetooth {
   static scanMode = bt.scanMode;
   
   constructor(onScanResultListener, onScanFailedListener) {
      this._listeners = [];
      
      [[
         bt.events.leScanCallback.SCAN_RESULT,
         onScanResultListener || this._onScanResult.bind(this)
      ], [
         bt.events.leScanCallback.SCAN_FAILED,
         onScanFailedListener || this._onScanFailed.bind(this)
      ]].forEach(data => this._listeners.push(
         emitter.addListener(data[0], data[1])));
      
      this._scanResults = [];
   }
   
   removeAllListeners() {
      this._listeners.forEach(listener => listener.remove());
   }
   
   isEnabled() {
      return bt.isEnabled();
   }
   
   async isKnownDeviceId(id) {
      return Platform.OS == "android" ? false : bt.isKnownDeviceId(id);
   }
   
   isScanStarted() {
      return this._scanStarted;
   }
   
   async startScan(options = {}, millis) {
      this._scanResults = [];
      this._scanOptions = { ...options };
      
      if (!millis) {
         millis = this._scanOptions.millis;
      }
      
      if (!this._scanOptions.minMillis) {
         this._scanOptions.minMillis = 2000;
      }
      
      millis = Math.max(millis, this._scanOptions.minMillis);
      
      await bt.startScan(this._scanOptions);
      
      this._scanStarted = true;
      
      const promises = [];
      let timeoutFired = false;
      
      if (millis) {
         promises.push(new Promise(resolve => setTimeout(() => {
            timeoutFired = true;
            resolve();
         }, millis)));
      }
      
      if (this._scanOptions.deviceCount) {
         promises.push(new Promise(async resolve => {
            await new Promise(r => setTimeout(r,
               this._scanOptions.minMillis))
            
            while (!timeoutFired && (this._scanOptions.
               deviceCount > this._scanResults.length))
            {
               await new Promise(r => setTimeout(r, 100));
            }
            
            resolve();
         }));
      }
      
      if (promises.length) {
         await Promise.race(promises);
         
         await this.stopScan();
      }
   }
   
   async stopScan() {
      this._scanStarted = false;
      
      await bt.stopScan();
   }
   
   getScanResults() {
      return [...this._scanResults];
   }
   
   _onScanResult(data) {
      for (let result of data.results) {
         if (this._scanResults.length == this._scanOptions.deviceCount) {
            break;
         }
         
         if (!this._scanResults.find(scanResult => scanResult.device.
            id == result.device.id) || this._scanOptions.allowDuplicates)
         {
            this._scanResults.push(result);
         }
      }
   }
   
   _onScanFailed(data) {
      console.log("Bluetooth._onScanFailed()", JSON.stringify(data));
   }
}
