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
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;

import java.lang.StringBuilder;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.UUID;

import ru.rshalimov.reactnative.common.Utils;

class Module extends ReactContextBaseJavaModule {
   private final class BTGattCallback extends BluetoothGattCallback {
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
            emit(eventName, putCommonGattParams(gatt, status));
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
         
         onReadWrittenChanged(gatt, ch, Boolean.TRUE, status);
      }
      
      @Override
      public void onCharacteristicWrite(
         BluetoothGatt gatt,
         BluetoothGattCharacteristic ch,
         int status)
      {
         super.onCharacteristicWrite(gatt, ch, status);
         
         onReadWrittenChanged(gatt, ch, Boolean.FALSE, status);
      }
      
      @Override
      public void onCharacteristicChanged(
         BluetoothGatt gatt,
         BluetoothGattCharacteristic ch)
      {
         super.onCharacteristicChanged(gatt, ch);
         
         onReadWrittenChanged(gatt, ch, null, BluetoothGatt.GATT_SUCCESS);
      }
      
      @Override
      public void onDescriptorRead(
         BluetoothGatt gatt,
         BluetoothGattDescriptor descriptor,
         int status)
      {
         super.onDescriptorRead(gatt, descriptor, status);
         
         onReadWrittenChanged(gatt, descriptor, Boolean.TRUE, status);
      }
      
      @Override
      public void onDescriptorWrite(
         BluetoothGatt gatt,
         BluetoothGattDescriptor descriptor,
         int status)
      {
         super.onDescriptorWrite(gatt, descriptor, status);
         
         onReadWrittenChanged(gatt, descriptor, Boolean.FALSE, status);
      }
   }
   
   private final class ScanCallback extends android.bluetooth.le.ScanCallback {
      @Override
      public void onBatchScanResults(List <ScanResult> results) {
         final WritableMap params = wrapScanResults(results);
         
         params.putBoolean("isBatch", true);
         
         emit(SCAN_RESULT, params);
      }
      
      @Override
      public void onScanFailed(int errorCode) {
         final WritableMap params = Arguments.createMap();
         
         params.putInt("errorCode", errorCode);
         
         emit(SCAN_FAILED, params);
      }
      
      @Override
      public void onScanResult(int callbackType, ScanResult result) {
         final WritableMap params = wrapScanResults(Arrays.asList(result));
         
         params.putInt("callbackType", callbackType);
         
         emit(SCAN_RESULT, params);
      }
   }
   
   private static final class WriteCharacteristicDescriptorData {
      private final Method setValue;
      private final Method write;
      private final String setValueError;
      private final String writeError;
      
      WriteCharacteristicDescriptorData(boolean isCharacteristic) {
         try {
            final Class <?> clazz = isCharacteristic ?
               BluetoothGattCharacteristic.class : BluetoothGattDescriptor.class;
            
            setValue = clazz.getMethod("setValue", byte[].class);
            
            write = BluetoothGatt.class.getMethod(isCharacteristic ?
               "writeCharacteristic" : "writeDescriptor", clazz);
            
            setValueError = String.format("%s.setValue() failed for ",
               clazz.getSimpleName());
            
            writeError = String.format("BluetoothGatt.%s() failed for ",
               write.getName());
         } catch (NoSuchMethodException e) {
            throw new RuntimeException(e);
         }
      }
      
      void write(
         Object setValueObject,
         byte [] value,
         BluetoothGatt gatt,
         StringBuilder sb)
      {
         try {
            if (!(Boolean)setValue.invoke(setValueObject, value)) {
               throw new IllegalStateException(sb
                  .insert(0, setValueError)
                  .toString());
            }
            
            if (!(Boolean)write.invoke(gatt, setValueObject)) {
               throw new IllegalStateException(sb
                  .insert(0, writeError)
                  .toString());
            }
            
            sb.insert(0, write.getName());
         } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
         }
      }
   }
   
   private static final String
      TAG = "SimpleBluetoothManager",
      CONNECTED = "CONNECTED",
      CONNECTING = "CONNECTING",
      DISCONNECTED = "DISCONNECTED",
      DISCONNECTING = "DISCONNECTING",
      SERVICES_DISCOVERED = "SERVICES_DISCOVERED",
      CHARACTERISTIC_READ = "CHARACTERISTIC_READ",
      CHARACTERISTIC_WRITTEN = "CHARACTERISTIC_WRITTEN",
      CHARACTERISTIC_CHANGED = "CHARACTERISTIC_CHANGED",
      DESCRIPTOR_READ = "DESCRIPTOR_READ",
      DESCRIPTOR_WRITTEN = "DESCRIPTOR_WRITTEN",
      SCAN_FAILED = "SCAN_FAILED",
      SCAN_RESULT = "SCAN_RESULT";
   
   private static final WriteCharacteristicDescriptorData
      writeCharacteristicData = new WriteCharacteristicDescriptorData(true);
      
   private static final WriteCharacteristicDescriptorData
      writeDescriptorData = new WriteCharacteristicDescriptorData(false);
   
   private final Map <String, BluetoothGatt> gatts = new HashMap <> ();
   private final Map <String, Map <String, Object>> readOptions = new HashMap <> ();
   private final BTGattCallback btGattCallback = new BTGattCallback();
   private final ScanCallback scanCallback = new ScanCallback();
   
   private boolean advertisementDataUnsigned;
   
   Module(ReactApplicationContext reactContext) {
      super(reactContext);
   }
   
   @Override
   public String getName() {
      return TAG;
   }
   
   @Override
   public Map <String, Object> getConstants() {
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
            CHARACTERISTIC_WRITTEN,
            CHARACTERISTIC_CHANGED,
            DESCRIPTOR_READ,
            DESCRIPTOR_WRITTEN
         }, {
            "leScanCallback",
            SCAN_FAILED,
            SCAN_RESULT
         }
      }) {
         final WritableMap map = Arguments.createMap();
         
         for (int index = 1; index < data.length; index++) {
            map.putString(data[index], data[index]);
         }
         
         events.putMap(data[0], map);
      }
      
      final WritableMap scanModes = Arguments.createMap();
      
      scanModes.putInt("LOW_POWER", ScanSettings.SCAN_MODE_LOW_POWER);
      scanModes.putInt("BALANCED", ScanSettings.SCAN_MODE_BALANCED);
      scanModes.putInt("LOW_LATENCY", ScanSettings.SCAN_MODE_LOW_LATENCY);
      
      final Map <String, Object> constants = new HashMap <> ();
      constants.put("events", events);
      constants.put("scanMode", scanModes);
      
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
   public void startScan(ReadableMap options, Promise promise) {
      try {
         final BluetoothLeScanner scanner =
            getAdapterEnsureEnabled().getBluetoothLeScanner();
         
         final List <ScanFilter> scanFilters = getScanFilters(Utils.
            safeGet(options, "filters", Arguments.createArray()));
         
         final ScanSettings scanSettings = getScanSettings(Utils.
            safeGet(options, "settings", Arguments.createMap()));
         
         advertisementDataUnsigned = Utils.safeGet(
            options, "advertisementDataUnsigned", true);
         
         Log.d(TAG, String.format("startScan(%s)", options));
         
         scanner.startScan(scanFilters, scanSettings, scanCallback);
         
         promise.resolve(null);
      } catch (IllegalStateException e) {
         promise.reject("", e.getMessage());
      }
   }
   
   @ReactMethod
   public void stopScan(Promise promise) {
      try {
         getAdapterEnsureEnabled().getBluetoothLeScanner().stopScan(scanCallback);
         
         Log.d(TAG, "stopScan()");
         
         promise.resolve(null);
      } catch (IllegalStateException e) {
         promise.reject("", e.getMessage());
      }
   }
   
   @ReactMethod
   public void connectGatt(String address, Boolean autoConnect, Promise promise) {
      final String addr = address.toUpperCase();
      
      try {
         if (!BluetoothAdapter.checkBluetoothAddress(addr)) {
            throw new IllegalArgumentException(String.
               format("Invalid device id: '%s'", addr));
         }
         
         final BluetoothAdapter adapter = getAdapterEnsureEnabled();
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
   public void connect(String address, Promise promise) {
      try {
         promise.resolve(getGatt(address).connect());
         
         Log.d(TAG, String.format("connect('%s')", address));
      } catch (IllegalStateException e) {
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
      try {
         final BluetoothGatt gatt = getGatt(address);
         
         final BluetoothGattCharacteristic ch = getCharacteristic(
            gatt, serviceUuid, characteristicUuid);
         
         if (!gatt.readCharacteristic(ch)) {
            throw new IllegalStateException("readCharacteristic failed.");
         }
         
         addRemoveReadOptions(true, options, address, serviceUuid, characteristicUuid);
         
         promise.resolve(null);
      } catch (IllegalStateException | IllegalArgumentException e) {
         promise.reject("", e.getMessage());
      }
   }
   
   @ReactMethod
   public void writeCharacteristic(
      String address,
      String serviceUuid,
      String characteristicUuid,
      ReadableMap dataAndOptions,
      Promise promise)
   {
      write(address, serviceUuid, characteristicUuid,
         null, dataAndOptions, promise);
   }
   
   @ReactMethod
   public void setCharacteristicNotification(
      String address,
      String serviceUuid,
      String characteristicUuid,
      Boolean enable,
      ReadableMap options,
      Promise promise)
   {
      try {
         final BluetoothGatt gatt = getGatt(address);
         
         final String logString = String.format("(%s, %s, %s, %s, %s)",
            address, serviceUuid, characteristicUuid, enable, options);
         
         if (!gatt.setCharacteristicNotification(getCharacteristic(
            gatt, serviceUuid, characteristicUuid), enable))
         {
            throw new IllegalStateException(String.format(
               "BluetoothGatt.setCharacteristicNotification() failed for %s",
                  logString));
         }
         
         addRemoveReadOptions(enable, options, address, serviceUuid, characteristicUuid);
         
         Log.d(TAG, String.format("setCharacteristicNotification%s", logString));
         
         promise.resolve(null);
      } catch (IllegalStateException | IllegalArgumentException e) {
         promise.reject("", e.getMessage());
      }
   }
   
   @ReactMethod
   public void writeDescriptor(
      String address,
      String serviceUuid,
      String characteristicUuid,
      String descriptorUuid,
      ReadableMap dataAndOptions,
      Promise promise)
   {
      write(address, serviceUuid, characteristicUuid,
         descriptorUuid, dataAndOptions, promise);
   }
   
   @ReactMethod
   public void disconnect(String address, Promise promise) {
      try {
         getGatt(address).disconnect();
         
         Log.d(TAG, String.format("disconnect('%s')", address));
         
         promise.resolve(null);
      } catch (IllegalStateException e) {
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
   
   private WritableMap putCommonGattParams(BluetoothGatt gatt, int status) {
      final WritableMap params = Arguments.createMap();
      
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
      
      final WritableMap params = putCommonGattParams(gatt, status);
      
      params.putArray("services", services);
      
      emit(SERVICES_DISCOVERED, params);
   }
   
   private WritableMap wrapScanResults(List <ScanResult> scanResults) {
      final WritableArray results = Arguments.createArray();
      
      for (ScanResult scanResult : scanResults) {
         // = device = //
         final WritableMap device = Arguments.createMap();
         final BluetoothDevice btDevice = scanResult.getDevice();
         
         device.putString("id", btDevice.getAddress());
         device.putString("name", btDevice.getName());
         
         // = scan record = //
         final WritableMap scanRecord = Arguments.createMap();
         final ScanRecord scRecord = scanResult.getScanRecord();
         
         scanRecord.putArray("bytes", Utils.writableArrayFrom(
            scRecord.getBytes(), !advertisementDataUnsigned));
         
         scanRecord.putString("name", scRecord.getDeviceName());
         
         // = result = //
         final WritableMap result = Arguments.createMap();
         
         result.putMap("device", device);
         result.putInt("rssi", scanResult.getRssi());
         result.putMap("scanRecord", scanRecord);
         
         results.pushMap(result);
      }
      
      final WritableMap params = Arguments.createMap();
      
      params.putArray("results", results);
      
      return params;
   }
   
   private void emit(String eventName, WritableMap params) {
      params.putString("eventName", eventName);
      
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
   
   private BluetoothGattDescriptor getDescriptor(
      BluetoothGatt gatt,
      BluetoothGattCharacteristic ch,
      String descriptorUuid)
   {
      final BluetoothGattDescriptor descr = ch.getDescriptor(
         UUID.fromString(descriptorUuid));
      
      if (descr == null) {
         throw new IllegalArgumentException(String.format(
            "Characteristic '%s' of service '%s' of '%s' has no descriptor with " +
               "uuid '%s'", ch.getUuid(), ch.getService().getUuid(), gatt.
                  getDevice().getAddress(), descriptorUuid));
      }
      
      return descr;
   }
   
   private void write(
      String address,
      String serviceUuid,
      String characteristicUuid,
      String descriptorUuid,
      ReadableMap dataAndOptions,
      Promise promise)
   {
      try {
         final BluetoothGatt gatt = getGatt(address);
         
         final BluetoothGattCharacteristic ch = getCharacteristic(
            gatt, serviceUuid, characteristicUuid);
         
         final BluetoothGattDescriptor descr = descriptorUuid ==
            null ? null : getDescriptor(gatt, ch, descriptorUuid);
         
         final byte [] value = Utils.createByteArray(
            dataAndOptions.getArray("value"));
         
         final StringBuilder sb = new StringBuilder("(")
            .append(address)
            .append(", ")
            .append(serviceUuid)
            .append(", ")
            .append(characteristicUuid);
         
         if (descriptorUuid != null) {
            sb
               .append(", ")
               .append(descriptorUuid);
         }
         
         sb
            .append(", ")
            .append(Arrays.toString(value))
            .append(')');
         
         (descr == null ? writeCharacteristicData : writeDescriptorData).
            write(descr == null ? ch : descr, value, gatt, sb);
         
         Log.d(TAG, sb.toString());
         
         promise.resolve(null);
      } catch (IllegalStateException | IllegalArgumentException e) {
         promise.reject("", e.getMessage());
      }
   }
   
   private void onReadWrittenChanged(
      BluetoothGatt gatt,
      Object object,
      Boolean read,
      int status)
   {
      final boolean isCh = object instanceof BluetoothGattCharacteristic;
      final boolean changed = read == null;
      
      final BluetoothGattDescriptor descr = isCh ?
         null : (BluetoothGattDescriptor)object;
      
      final BluetoothGattCharacteristic ch = isCh ?
         (BluetoothGattCharacteristic)object : descr.getCharacteristic();
      
      final String address = gatt.getDevice().getAddress();
      final String serviceUuid = ch.getService().getUuid().toString();
      final String characteristicUuid = ch.getUuid().toString();
      
      final String descriptorUuid = descr != null ?
         descr.getUuid().toString() : null;
      
      final StringBuilder sb = new StringBuilder("on")
         .append(isCh ? "Characteristic" : "Descriptor")
         .append(changed ? "Changed" : read ? "Read" : "Write")
         .append('(')
         .append(address)
         .append(", ")
         .append(serviceUuid)
         .append(", ")
         .append(characteristicUuid);
      
      if (descriptorUuid != null) {
         sb
            .append(", ")
            .append(descriptorUuid);
      }
      
      sb
         .append(", ")
         .append(status)
         .append(')');
      
      Log.d(TAG, sb.toString());
      
      final WritableMap params = putCommonGattParams(gatt, status);
      
      params.putString("serviceUuid", serviceUuid);
      params.putString("characteristicUuid", characteristicUuid);
      
      if (descriptorUuid != null) {
         params.putString("descriptorUuid", descriptorUuid);
      }
      
      if (changed || read) {
         final String readOptionsKey = getReadOptionsKey(address, serviceUuid, characteristicUuid, descriptorUuid);
         
         final Map <String, Object> options = readOptions.get(readOptionsKey);
         
         if (options != null && (Boolean)options.get("asString")) {
            final Integer offset = (Integer)options.get("offset");
            
            params.putString("value", ch.getStringValue(offset == null ? 0 : offset));
         } else {
            params.putArray("value", Utils.writableArrayFrom(isCh ? ch.getValue() : descr.getValue(), options == null || !options.containsKey("valueUnsigned") ? true : !(Boolean)options.get("valueUnsigned")));
         }
         
         if (!changed && read) {
            readOptions.remove(readOptionsKey);
         }
      }
      
      emit(isCh ? (changed ? CHARACTERISTIC_CHANGED : (read ? CHARACTERISTIC_READ :
         CHARACTERISTIC_WRITTEN)) : (read ? DESCRIPTOR_READ : DESCRIPTOR_WRITTEN),
            params);
   }
   
   private BluetoothAdapter getAdapterEnsureEnabled() {
      final BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
      
      if (!adapter.isEnabled()) {
         throw new IllegalStateException("Bluetooth is not enabled");
      }
      
      return adapter;
   }
   
   private List <ScanFilter> getScanFilters(ReadableArray filters) {
      final List <ScanFilter> scanFilters = new ArrayList <> ();
      
      for (int index = 0; index < filters.size(); index++) {
         final ScanFilter.Builder builder = new ScanFilter.Builder();
         final ReadableMap filter = filters.getMap(index);
         
         if (filter.hasKey("deviceId")) {
            builder.setDeviceAddress(filter.getString("deviceId"));
         }
         
         if (filter.hasKey("deviceName")) {
            builder.setDeviceName(filter.getString("deviceName"));
         }
         
         scanFilters.add(builder.build());
      }
      
      return scanFilters;
   }
   
   private ScanSettings getScanSettings(ReadableMap settings) {
      final ScanSettings.Builder builder = new ScanSettings.Builder();
      
      if (settings.hasKey("reportDelay")) {
         builder.setReportDelay(Long.parseLong(settings.getString("reportDelay")));
      }
      
      if (settings.hasKey("scanMode")) {
         builder.setScanMode(settings.getInt("scanMode"));
      }
      
      return builder.build();
   }
   
   private String getReadOptionsKey(String ... parts) {
      final StringBuilder sb = new StringBuilder();
      
      for (String part : parts) {
         if (part != null) {
            sb.append(part);
         }
      }
      
      return sb.toString().toLowerCase();
   }
   
   private void addRemoveReadOptions(
      Boolean enable,
      ReadableMap options,
      String ... parts)
   {
      final String readOptionsKey = getReadOptionsKey(parts);
      
      if (enable && options != null) {
         readOptions.put(readOptionsKey, options.toHashMap());
      } else {
         readOptions.remove(readOptionsKey);
      }
   }
}
