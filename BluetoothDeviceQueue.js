import { AbstractQueue } from "simple-common-utils";

export default class BluetoothDeviceQueue extends AbstractQueue {
   constructor(device) {
      super(new Map());
      
      this.device = device;
   }
   
   async _process() {
      const args = Array.from(arguments);
      const isCharacteristic = args.shift();
      
      return await this.device[`write${isCharacteristic ? "Characteristic" : "Descriptor"}`](...args);
   }
}
