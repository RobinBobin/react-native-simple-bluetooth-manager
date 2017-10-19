import {
   NativeModules,
   NativeEventEmitter
} from "react-native";

const bt = NativeModules.SimpleBluetoothManager;
const emitter = new NativeEventEmitter(bt);

export default class BluetoothDevice {
   static CONNECTION_STATE_CONNECTED = bt.CONNECTION_STATE_CONNECTED;
   static CONNECTION_STATE_CONNECTING = bt.CONNECTION_STATE_CONNECTING;
   static CONNECTION_STATE_DISCONNECTED = bt.CONNECTION_STATE_DISCONNECTED;
   static CONNECTION_STATE_DISCONNECTING = bt.CONNECTION_STATE_DISCONNECTING;
   
   constructor(id) {
      this.id = id || "";
      this.listeners = [];
   }
   
   isValid() {
      return bt.checkBluetoothAddress(id);
   }
   
   addListener(eventType, listener) {
      this.listeners.push(emitter.addListener(eventType, listener))
   }
   
   addConnectedDisconnectedListeners(connected, disconnected) {
      this.addListener(BluetoothDevice.CONNECTION_STATE_CONNECTED, connected);
      this.addListener(BluetoothDevice.CONNECTION_STATE_DISCONNECTED, disconnected);
   }
   
   removeAllListeners() {
      this.listeners.forEach(listener => listener.remove());
   }
   
   connectGatt(autoConnect = true, error = console.log) {
      bt.connectGatt(this.id, autoConnect, error);
   }
   
   closeGatt(error = console.log) {
      bt.closeGatt(this.id, error);
   }
}
