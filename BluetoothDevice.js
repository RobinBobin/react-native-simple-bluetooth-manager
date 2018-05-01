import {
   NativeModules,
   NativeEventEmitter,
   Platform
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
         return this._addListener(bt.events.connectionState.CONNECTED, l);
      }
      
      setOnDisconnectedListener(l) {
         return this._addListener(bt.events.connectionState.DISCONNECTED, l);
      }
      
      setOnServicesDiscoveredListener(l) {
         return this._addListener(bt.events.gatt.SERVICES_DISCOVERED, l);
      }
      
      setOnCharacteristicReadListener(l) {
         return this._addListener(bt.events.gatt.CHARACTERISTIC_READ, l);
      }
      
      setOnCharacteristicWrittenListener(l) {
         return this._addListener(bt.events.gatt.CHARACTERISTIC_WRITTEN, l);
      }
      
      setOnCharacteristicChangedListener(l) {
         return this._addListener(bt.events.gatt.CHARACTERISTIC_CHANGED, l);
      }
      
      setOnDescriptorReadListener(l) {
         return this._addListener(bt.events.gatt.DESCRIPTOR_READ, l);
      }
      
      setOnDescriptorWrittenListener(l) {
         return this._addListener(bt.events.gatt.DESCRIPTOR_WRITTEN, l);
      }
      
      build() {
         return new BluetoothDevice(this);
      }
      
      _addListener(eventType, listener) {
         this.listeners.push({eventType, listener});
         
         return this;
      }
   };
   
   constructor(builder) {
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
   
   areServicesDiscovered() {
      return !!this.servicesDiscovered;
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
      return bt.isValid(this.getId());
   }
   
   async connectGatt(autoConnect = true) {
      await bt.connectGatt(this.getId(), autoConnect);
   }
   
   async discoverServices(useCache = true) {
      await bt.discoverServices(this.getId(), useCache);
   }
   
   async readCharacteristic(serviceUuid, characteristicUuid, options) {
      await this._safeReadWrite(true, arguments);
   }
   
   async writeCharacteristic(serviceUuid, characteristicUuid, dataAndOptions) {
      if (!dataAndOptions
         || (dataAndOptions.chunkSize == undefined)
         || !Array.isArray(dataAndOptions.value)
         || dataAndOptions.value.length <= dataAndOptions.chunkSize)
      {
         await this._safeReadWrite(false, arguments);
      } else {
         if (dataAndOptions.chunkSize <= 0) {
            throw new Error(`dataAndOptions.chunkSize (${
               dataAndOptions.chunkSize}) can't be <= 0`);
         }
         
         for (let i = 0; i < dataAndOptions.value.length;) {
            await this._safeReadWrite(false, [
               serviceUuid,
               characteristicUuid,
               Object.assign({}, dataAndOptions, {value: dataAndOptions.
                  value.slice(i, i += dataAndOptions.chunkSize)})
            ]);
         }
      }
   }
   
   async setCharacteristicNotification(
      serviceUuid,
      characteristicUuid,
      enable,
      options)
   {
      await bt.setCharacteristicNotification(this.getId(),
         serviceUuid, characteristicUuid, enable, options);
      
      if (Platform.OS == "android") {
         await this._safeReadWrite(false, [
            serviceUuid,
            characteristicUuid,
            "00002902-0000-1000-8000-00805f9b34fb",
            {value: [+enable, 0]}
         ]);
      }
   }
   
   async readDescriptor(
      serviceUuid,
      characteristicUuid,
      descriptorUuid,
      options)
   {
      await this._safeReadWrite(true, arguments);
   }
   
   async writeDescriptor(
      serviceUuid,
      characteristicUuid,
      descriptorUuid,
      dataAndOptions)
   {
      await this._safeReadWrite(false, arguments);
   }
   
   async closeGatt() {
      await bt.closeGatt(this.getId());
   }
   
   async _safeReadWrite(read, params) {
      const operation = read ? "read" : "write";
      const requests = this.requests[operation];
      
      let request;
      
      if (!params.length) {
         requests.shift();
         request = requests[0];
      } else {
         request = {
            serviceUuid: params[0],
            characteristicUuid: params[1],
            obj: params[params.length - 1]
         };
         
         if (params.length == 4) {
            request.descriptorUuid = params[2];
         };
      }
      
      if (request != undefined && (!params.length || !requests.length)) {
         const ar = [
            this.getId(),
            request.serviceUuid,
            request.characteristicUuid,
         ];
         
         const descrOp = request.hasOwnProperty("descriptorUuid");
         
         if (descrOp) {
            ar.push(request.descriptorUuid);
         }
         
         ar.push(request.obj);
         
         await bt[operation + (descrOp ? "Descriptor" :
            "Characteristic")].apply(null, ar);
      }
      
      params.length && requests.push(request);
   }
   
   _innerListener(listener, data) {
      if (data.id.valueOf() == this.getId()) {
         switch (listener.eventType) {
            case bt.events.connectionState.CONNECTED:
               this.connected = !data.error;
               break;
            
            case bt.events.connectionState.DISCONNECTED:
               this.connected = false;
               this.servicesDiscovered = false;
               break;
            
            case bt.events.gatt.SERVICES_DISCOVERED:
               this.servicesDiscovered = !data.error;
               break;
         }
         
         listener.listener(data);
      }
   }
}
