import {
   NativeModules,
   NativeEventEmitter
} from "react-native";

const bt = NativeModules.SimpleBluetoothManager;
const emitter = new NativeEventEmitter(bt);

export default class BluetoothDevice {
   static events = bt.events;
   
   constructor(
      id,
      connected,
      disconnected,
      servicesDiscovered,
      characteristicRead,
      characteristicWritten,
      characteristicChanged)
   {
      this.id = id || "";
      this.listeners = [];
      this.readRequests = [];
      this.writeRequests = [];
      
      for (data of [
         [BluetoothDevice.events.connectionState.CONNECTED, connected],
         [BluetoothDevice.events.connectionState.DISCONNECTED, disconnected],
         [BluetoothDevice.events.gatt.SERVICES_DISCOVERED, servicesDiscovered],
         [BluetoothDevice.events.gatt.CHARACTERISTIC_READ,
            characteristicRead, this._characteristicReadWritten],
         [BluetoothDevice.events.gatt.CHARACTERISTIC_WRITTEN,
            characteristicWritten, this._characteristicReadWritten]
      ]) {
         for (let index = 1; index < data.length; index++) {
            if (data[index]) {
               this.addListener(data[0], data[index]);
            }
         }
      }
   }
   
   addListener(eventType, listener) {
      // console.log(`addListener(): ${eventType}`);
      this.listeners.push(emitter.addListener(eventType, listener));
   }
   
   removeAllListeners() {
      this.listeners.forEach(listener => listener.remove());
   }
   
   isValid() {
      return bt.isValid(id);
   }
   
   isEnabled() {
      return bt.isEnabled();
   }
   
   connectGatt(autoConnect = true) {
      return bt.connectGatt(this.id, autoConnect);
   }
   
   discoverServices(useCache = true) {
      return bt.discoverServices(this.id, useCache);
   }
   
   readCharacteristic(serviceUuid, characteristicUuid, options) {
      return this._safeReadWrite(
         true, {
            serviceUuid,
            characteristicUuid,
            obj: options
         });
   }
   
   writeCharacteristic(serviceUuid, characteristicUuid, dataAndOptions) {
      return this._safeReadWrite(
         false, {
            serviceUuid,
            characteristicUuid,
            obj: dataAndOptions
         });
   }
   
   closeGatt() {
      return bt.closeGatt(this.id);
   }
   
   async _safeReadWrite(read, request) {
      const operation = read ? "read" : "write";
      const requests = this[operation + "Requests"];
      
      const result = requests.length ? undefined :
         await bt[operation + "Characteristic"](
            this.id,
            request.serviceUuid,
            request.characteristicUuid,
            request.obj);
      
      requests.push(request);
      
      return result;
   }
   
   _characteristicReadWritten({id, eventName}) {
      if (id.valueOf() == this.id) {
         const read = eventName.valueOf() == bt.events.gatt.CHARACTERISTIC_READ;
         const operation = read ? "read" : "write";
         const requests = this[operation + "Requests"];
         
         requests.shift();
         
         if (requests.length) {
            bt[operation + "Characteristic"](
               this.id,
               requests[0].serviceUuid,
               requests[0].characteristicUuid,
               requests[0].obj).catch(error => {
                  console.log(error);
                  
                  this._characteristicReadWritten(id, eventName);
               });
         }
      }
   }
}
