package ru.rshalimov.reactnative.simplebluetoothmanager;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.RCTNativeAppEventEmitter;

import android.util.Log;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothProfile;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.UUID;

class Module extends ReactContextBaseJavaModule {
   private final class BTGattCallback extends BluetoothGattCallback
   {
      @Override
      public void onConnectionStateChange(
         BluetoothGatt gatt,
         int status,
         int newState)
      {
         super.onConnectionStateChange(gatt, status, newState);
         
         Log.d(Module.TAG, String.format(
            "onConnectionStateChange('%s', status=%d, newState=%d)",
               gatt.getDevice().getAddress(), status, newState));
         
         final String eventName =
            newState == BluetoothProfile.STATE_CONNECTED ? CONNECTED :
            newState == BluetoothProfile.STATE_CONNECTING ? CONNECTING :
            newState == BluetoothProfile.STATE_DISCONNECTED ? DISCONNECTED :
            newState == BluetoothProfile.STATE_DISCONNECTING ? DISCONNECTING :
            null;
         
         if (eventName != null) {
            emit(eventName, putCommonParams(eventName, gatt, status));
         }
      }
      
      @Override
      public void onServicesDiscovered(BluetoothGatt gatt, int status) {
         super.onServicesDiscovered(gatt, status);
         
         Log.d(Module.TAG, String.format("onServicesDiscovered('%s', %d)",
            gatt.getDevice().getAddress(), status));
         
         emitServices(gatt, status);
      }
      
      @Override
      public void onCharacteristicRead(
         BluetoothGatt gatt,
         BluetoothGattCharacteristic ch,
         int status)
      {
         super.onCharacteristicRead(gatt, ch, status);
         
         Log.d(TAG, String.format("onCharacteristicRead() not implemented yet"));
      }
      
      @Override
      public void onCharacteristicWrite(
         BluetoothGatt gatt,
         BluetoothGattCharacteristic ch,
         int status)
      {
         super.onCharacteristicWrite(gatt, ch, status);
         
         final String serviceUuid = ch.getService().getUuid().toString();
         
         Log.d(TAG, String.format("onCharacteristicWrite(%s, %s, %s, %d)",
            gatt.getDevice().getAddress(), serviceUuid, ch.getUuid(), status));
         
         final WritableMap params = putCommonParams(
            CHARACTERISTIC_WRITTEN, gatt, status);
         
         params.putString("serviceUuid", serviceUuid);
         params.putString("characteristicUuid", ch.getUuid().toString());
         
         emit(CHARACTERISTIC_WRITTEN, params);
      }
   }
   
   static final String
      TAG = "SimpleBluetoothManager",
      CONNECTED = "CONNECTED",
      CONNECTING = "CONNECTING",
      DISCONNECTED = "DISCONNECTED",
      DISCONNECTING = "DISCONNECTING",
      SERVICES_DISCOVERED = "SERVICES_DISCOVERED",
      CHARACTERISTIC_READ = "CHARACTERISTIC_READ",
      CHARACTERISTIC_WRITTEN = "CHARACTERISTIC_WRITTEN";
   
   private final Map <String, BluetoothGatt> gatts = new HashMap <> ();
   private final BTGattCallback btGattCallback = new BTGattCallback();
   
   Module(ReactApplicationContext reactContext) {
      super(reactContext);
   }
   
   @Override
   public String getName() {
      return TAG;
   }
   
   @Override
   public Map <String, Object> getConstants() {
      final Map <String, Object> constants = new HashMap <> ();
      final WritableMap events = Arguments.createMap();
      
      for (String [] data : new String [][] {
         {
            "connectionState",
            CONNECTED,
            CONNECTING,
            DISCONNECTED,
            DISCONNECTING
         }, {
            "gatt",
            SERVICES_DISCOVERED,
            CHARACTERISTIC_READ,
            CHARACTERISTIC_WRITTEN
         }
      }) {
         final WritableMap map = Arguments.createMap();
         
         for (int index = 1; index < data.length; index++) {
            map.putString(data[index], data[index]);
         }
         
         events.putMap(data[0], map);
      }
      
      constants.put("events", events);
      
      return constants;
   }
   
   @ReactMethod
   public void isValid(String address, Promise promise) {
      final String addr = address.toUpperCase();
      
      if (BluetoothAdapter.checkBluetoothAddress(addr)) {
         promise.resolve(null);
      } else {
         promise.reject("", String.format(
            "Invalid device id: '%s'", addr));
      }
   }
   
   @ReactMethod
   public void isEnabled(Promise promise) {
      promise.resolve(BluetoothAdapter.getDefaultAdapter().isEnabled());
   }
   
   @ReactMethod
   public void connectGatt(String address, Boolean autoConnect, Promise promise) {
      final String addr = address.toUpperCase();
      
      try {
         if (!BluetoothAdapter.checkBluetoothAddress(addr)) {
            throw new IllegalArgumentException(String.
               format("Invalid device id: '%s'", addr));
         }
         
         final BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
         
         if (!adapter.isEnabled()) {
            throw new IllegalStateException("Bluetooth is not enabled");
         }
         
         final boolean connect = !gatts.containsKey(addr);
         
         if (connect) {
            gatts.put(addr, adapter.getRemoteDevice(addr).connectGatt(
               getReactApplicationContext(), autoConnect, btGattCallback));
         }
         
         Log.d(TAG, String.format("connectGatt('%s', %s), %s",
            addr, autoConnect, connect));
         
         promise.resolve(null);
      } catch (IllegalArgumentException | IllegalStateException e) {
         promise.reject("", e.getMessage());
      }
   }
   
   @ReactMethod
   public void discoverServices(String address, Boolean useCache, Promise promise) {
      try {
         final BluetoothGatt gatt = getGatt(address);
         final boolean cacheUsed = useCache && !gatt.getServices().isEmpty();
         
         if (cacheUsed) {
            emitServices(gatt, BluetoothGatt.GATT_SUCCESS);
         } else if (!gatt.discoverServices()) {
            throw new IllegalStateException(String.format(
               "BluetoothGatt.discoverServices() failed for '%s'", address));
         }
         
         Log.d(TAG, String.format("discoverServices('%s', %s), %s",
            address, useCache, cacheUsed));
         
         promise.resolve(null);
      } catch (IllegalStateException e) {
         promise.reject("", e.getMessage());
      }
   }
   
   @ReactMethod
   public void readCharacteristic(
      String address,
      String serviceUuid,
      String characteristicUuid,
      ReadableMap options,
      Promise promise)
   {
      promise.reject("", "Not implemented yet");
   }
   
   @ReactMethod
   public void writeCharacteristic(
      String address,
      String serviceUuid,
      String characteristicUuid,
      ReadableMap dataAndOptions,
      Promise promise)
   {
      try {
         final BluetoothGatt gatt = getGatt(address);
         
         final BluetoothGattCharacteristic ch = getCharacteristic(
            gatt, serviceUuid, characteristicUuid);
         
         final ReadableArray value = dataAndOptions.getArray("value");
         final byte [] valueBuffer = new byte[value.size()];
         
         for (int index = 0; index < valueBuffer.length; index++) {
            valueBuffer[index] = (byte)value.getInt(index);
         }
         
         final String logString = String.format("(%s, %s, %s, %s)", address,
            serviceUuid, characteristicUuid, Arrays.toString(valueBuffer));
         
         if (!ch.setValue(valueBuffer)) {
            throw new IllegalStateException(String.format(
               "Characteristic.setValue() failed for %s", logString));
         }
         
         if (!gatt.writeCharacteristic(ch)) {
            throw new IllegalStateException(String.format(
               "BluetoothGatt.writeCharacteristic() failed for %s", logString));
         }
         
         Log.d(TAG, String.format("writeCharacteristic%s", logString));
         
         promise.resolve(null);
      } catch (IllegalStateException | IllegalArgumentException e) {
         promise.reject("", e.getMessage());
      }
   }
   
   @ReactMethod
   public void closeGatt(String address, Promise promise) {
      try {
         final BluetoothGatt gatt = getGatt(address);
         
         if (gatts.remove(gatt.getDevice().getAddress()) == null) {
            throw new IllegalStateException(String.format(
               "gatts.remove('%s') == null", gatt.getDevice().getAddress()));
         }
         
         gatt.close();
         
         Log.d(TAG, String.format("closeGatt('%s')", address));
         
         promise.resolve(null);
      } catch (IllegalStateException e) {
         promise.reject("", e.getMessage());
      }
   }
   
   private BluetoothGatt getGatt(String address) {
      final String addr = address.toUpperCase();
      final BluetoothGatt gatt = gatts.get(addr);
      
      if (gatt == null) {
         throw new IllegalStateException(String.format(
            "GATT for '%s' hasn't been connected", addr));
      }
      
      return gatt;
   }
   
   private WritableMap putCommonParams(
      String eventName,
      BluetoothGatt gatt,
      int status)
   {
      final WritableMap params = Arguments.createMap();
      
      params.putString("eventName", eventName);
      params.putString("id", gatt.getDevice().getAddress());
      params.putInt("status", status);
      params.putBoolean("error", status != BluetoothGatt.GATT_SUCCESS);
      
      return params;
   }
   
   private void emitServices(BluetoothGatt gatt, int status) {
      final WritableArray services = Arguments.createArray();
      
      for (BluetoothGattService service : gatt.getServices()) {
         final WritableArray chars = Arguments.createArray();
         
         for (BluetoothGattCharacteristic ch : service.getCharacteristics()) {
            final WritableMap c = Arguments.createMap();
            
            c.putString("uuid", ch.getUuid().toString());
            c.putInt("instanceId", ch.getInstanceId());
            c.putInt("permissions", ch.getPermissions());
            c.putInt("properties", ch.getProperties());
            c.putInt("writeType", ch.getWriteType());
            
            chars.pushMap(c);
         }
         
         final WritableMap srvc = Arguments.createMap();
         
         srvc.putString("uuid", service.getUuid().toString());
         srvc.putInt("instanceId", service.getInstanceId());
         srvc.putArray("characteristics", chars);
         
         services.pushMap(srvc);
      }
      
      final WritableMap params = putCommonParams(SERVICES_DISCOVERED, gatt, status);
      
      params.putArray("services", services);
      
      emit(SERVICES_DISCOVERED, params);
   }
   
   private void emit(String eventName, WritableMap params) {
      getReactApplicationContext()
         .getJSModule(RCTNativeAppEventEmitter.class)
         .emit(eventName, params);
   }
   
   private BluetoothGattCharacteristic getCharacteristic(
      BluetoothGatt gatt,
      String serviceUuid,
      String characteristicUuid)
   {
      final String address = gatt.getDevice().getAddress();
      
      if (gatt.getServices().isEmpty()) {
         throw new IllegalStateException(String.format(
            "Services haven't been discovered yet for '%s'", address));
      }
      
      final BluetoothGattService service = gatt.
         getService(UUID.fromString(serviceUuid));
      
      if (service == null) {
         throw new IllegalArgumentException(String.format(
            "'%s' has no service with uuid '%s'", address, serviceUuid));
      }
      
      final BluetoothGattCharacteristic ch = service.
         getCharacteristic(UUID.fromString(characteristicUuid));
      
      if (ch == null) {
         throw new IllegalArgumentException(String.format(
            "Service '%s' of '%s' has no characteristic with uuid '%s'",
               serviceUuid, address, characteristicUuid));
      }
      
      return ch;
   }
}
