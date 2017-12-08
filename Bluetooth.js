import {
   NativeModules,
   NativeEventEmitter
} from "react-native";

const bt = NativeModules.SimpleBluetoothManager;
const emitter = new NativeEventEmitter(bt);

export default class Bluetooth {
   constructor(onScanResultListener, onScanFailedListener) {
      this.listeners = [];
      
      [
         bt.events.leScanCallback.SCAN_RESULT,
         bt.events.leScanCallback.SCAN_FAILED
      ].forEach((eventType, index) => this.listeners.push(
         emitter.addListener(eventType, arguments[index])));
      
      Bluetooth.scanMode = bt.scanMode;
   }
   
   removeAllListeners() {
      this.listeners.forEach(listener => listener.remove());
   }
   
   isEnabled() {
      return bt.isEnabled();
   }
   
   startScan(options = {}) {
      return bt.startScan(options);
   }
   
   stopScan() {
      return bt.stopScan();
   }
}
