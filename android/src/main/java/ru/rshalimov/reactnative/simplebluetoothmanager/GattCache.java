package ru.rshalimov.reactnative.simplebluetoothmanager;

import android.bluetooth.BluetoothGatt;

class GattCache {
   final BluetoothGatt gatt;
   
   GattCache(BluetoothGatt gatt) {
      this.gatt = gatt;
   }
}
