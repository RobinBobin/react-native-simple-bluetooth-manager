import {
   NativeModules,
   NativeEventEmitter
} from "react-native";

const bt = NativeModules.SimpleBluetoothManager;
const emitter = new NativeEventEmitter(bt);

export default class Bluetooth {
   static scanMode = bt.scanMode;
   
   constructor(onScanResultListener, onScanFailedListener) {
      this._listeners = [];
      this._scanResults = [];
      
      [[
         bt.events.leScanCallback.SCAN_RESULT,
         onScanResultListener || (data => this._scanResults.push(data))
      ], [
         bt.events.leScanCallback.SCAN_FAILED,
         onScanFailedListener || console.log
      ]].forEach(data => this._listeners.push(
         emitter.addListener(data[0], data[1])));
   }
   
   removeAllListeners() {
      this._listeners.forEach(listener => listener.remove());
   }
   
   isEnabled() {
      return bt.isEnabled();
   }
   
   async startScan(options = {}, millis) {
      this._scanResults.length = 0;
      
      await bt.startScan(options);
      
      if (millis) {
         await new Promise(resolve => setTimeout(resolve, millis));
         
         await this.stopScan();
      }
   }
   
   async stopScan() {
      await bt.stopScan();
   }
   
   getScanResults() {
      return Array.from(this._scanResults);
   }
}
