import {
   NativeModules,
   NativeEventEmitter
} from "react-native";

const bt = NativeModules.SimpleBluetoothManager;
const emitter = new NativeEventEmitter(bt);

export default class BluetoothDevice {
   static Builder = class {
      constructor(id) {
         this.id = id || "";
         this.listeners = [];
      }
      
      setOnConnectedListener(l) {
         return this._addListener(bt.events.
            connectionState.CONNECTED, "onConnected", l);
      }
      
      setOnDisconnectedListener(l) {
         return this._addListener(bt.events.
            connectionState.DISCONNECTED, "onDisconnected", l);
      }
      
      setOnServicesDiscoveredListener(l) {
         return this._addListener(bt.events.gatt.
            SERVICES_DISCOVERED, "onServicesDiscovered", l);
      }
      
      setOnCharacteristicReadListener(l) {
         return this._addListener(bt.events.gatt.
            CHARACTERISTIC_READ, "onCharacteristicRead", l);
      }
      
      setOnCharacteristicWrittenListener(l) {
         return this._addListener(bt.events.gatt.
            CHARACTERISTIC_WRITTEN, "onCharacteristicWritten", l);
      }
      
      setOnCharacteristicChangedListener(l) {
         return this._addListener(bt.events.gatt.
            CHARACTERISTIC_CHANGED, "onCharacteristicChanged", l);
      }
      
      build() {
         return new BluetoothDevice(this);
      }
      
      _addListener(eventType, eventName, listener) {
         this.listeners.push({eventType, eventName, listener});
         
         return this;
      }
   };
   
   constructor(builder)
   {
      this.builder = builder;
      
      this.requests = {
         read: [],
         write: []
      };
      
      for (let listener of this.builder.listeners) {
         listener.innerListener = emitter.addListener(listener.
            eventType, this._innerListener.bind(this, listener));
      }
   }
   
   getId() {
      return this.builder.id;
   }
   
   isConnected() {
      return !!this.connected;
   }
   
   setConnected(connected) {
      this.connected = connected;
   }
   
   flushRequests(read) {
      if (read == true || read == undefined) {
         this.requests.read.length = 0;
      }
      
      if (read == false || read == undefined) {
         this.requests.write.length = 0;
      }
   }
   
   removeAllListeners() {
      this.builder.listeners.forEach(listener => listener.innerListener.remove());
   }
   
   isValid() {
      return bt.isValid(id);
   }
   
   isEnabled() {
      return bt.isEnabled();
   }
   
   connectGatt(autoConnect = true) {
      return bt.connectGatt(this.getId(), autoConnect);
   }
   
   discoverServices(useCache = true) {
      return bt.discoverServices(this.getId(), useCache);
   }
   
   readCharacteristic(serviceUuid, characteristicUuid, options) {
      return this._safeReadWrite(true, arguments);
   }
   
   writeCharacteristic(serviceUuid, characteristicUuid, dataAndOptions) {
      return this._safeReadWrite(false, arguments);
   }
   
   closeGatt() {
      return bt.closeGatt(this.getId());
   }
   
   async _safeReadWrite(read, params) {
      const operation = read ? "read" : "write";
      const requests = this.requests[operation];
      
      const request = params.length ? {
         serviceUuid: params[0],
         characteristicUuid: params[1],
         obj: params[2]
      } : (requests.shift(), requests[0]);
      
      const result = request == undefined || (params.length && requests.
         length) ? undefined : await bt[operation + "Characteristic"](
            this.getId(),
            request.serviceUuid,
            request.characteristicUuid,
            request.obj);
      
      params.length && requests.push(request);
      
      return result;
   }
   
   _innerListener(listener, data) {
      data.id.valueOf() == this.builder.id && listener.listener(data);
   }
}