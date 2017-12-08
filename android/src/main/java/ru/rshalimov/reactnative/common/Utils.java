package ru.rshalimov.reactnative.common;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;

import java.lang.reflect.Method;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

public class Utils {
   private static final Map <Class <?>, Method> safeGets = new HashMap <> ();
   
   private static final List <Class <?>> assignableClasses = Arrays.asList(
      null,
      ReadableArray.class,
      ReadableMap.class
   );
   
   static {
      try {
         for (Object [] data : new Object [][] {
            { Boolean.class, "getBoolean" },
            { Double.class, "getDouble" },
            { Integer.class, "getInt" },
            { String.class, "getString" },
            { ReadableArray.class, "getArray" },
            { ReadableMap.class, "getMap" }
         })
         {
            safeGets.put((Class <?>)data[0], ReadableMap.
               class.getMethod((String)data[1], String.class));
         }
      } catch (ReflectiveOperationException e) {
         throw new RuntimeException(e);
      }
   }
   
   public static <T> T safeGet(ReadableMap map, String key, Class <?> clazz) {
      try {
         Object result = null;
         
         if (map.hasKey(key)) {
            assignableClasses.set(0, clazz);
            
            Method method = null;
            
            for (int i = 0; i < assignableClasses.size() && method == null; i++) {
               final Class <?> assignableClass = assignableClasses.get(i);
               
               if (assignableClass.isAssignableFrom(clazz)) {
                  method = safeGets.get(assignableClass);
               }
            }
            
            if (method != null) {
               result = method.invoke(map, key);
            }
         }
         
         @SuppressWarnings("unchecked")
         final T res = (T)result;
         
         return res;
      } catch (ReflectiveOperationException e) {
         throw new RuntimeException(e);
      }
   }
   
   public static <T> T safeGet(ReadableMap map, String key, T defaultValue) {
      final T result = safeGet(map, key, defaultValue.getClass());
      
      return result == null ? defaultValue : result;
   }
   
   public static ReadableArray safeGetArray(ReadableMap map, String key) {
      return safeGet(map, key, ReadableArray.class);
   }
   
   public static ReadableMap safeGetMap(ReadableMap map, String key) {
      return safeGet(map, key, ReadableMap.class);
   }
   
   public static String getFileNameExtension(
      ReadableMap map,
      String nameKey,
      String extensionKey,
      String defaultName)
   {
      return getFileNameExtension(map, nameKey, extensionKey, defaultName, "");
   }
   
   public static String getFileNameExtension(
      ReadableMap map,
      String nameKey,
      String extensionKey,
      String defaultName,
      String defaultExtension)
   {
      final String fileName = safeGet(map, nameKey, defaultName);
      final String fileExtension = safeGet(map, extensionKey, defaultExtension);
      
      return fileExtension == null || fileExtension.isEmpty() ?
         fileName : String.format("%s.%s", fileName, fileExtension);
   }
   
   public static byte [] createByteArray(ReadableArray array) {
      final byte [] ar = new byte[array.size()];
      
      for (int index = 0; index < ar.length; index++) {
         ar[index] = (byte)array.getInt(index);
      }
      
      return ar;
   }
   
   public static WritableArray writableArrayFrom(byte [] array) {
      final WritableArray wa = Arguments.createArray();
      
      for (byte value : array) {
         wa.pushInt(value);
      }
      
      return wa;
   }
}
