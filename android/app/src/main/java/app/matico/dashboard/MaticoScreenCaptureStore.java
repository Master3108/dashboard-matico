package app.matico.dashboard;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

public final class MaticoScreenCaptureStore {
    private static final List<JSObject> QUEUE = Collections.synchronizedList(new ArrayList<>());
    private static volatile boolean active = false;

    private MaticoScreenCaptureStore() {}

    public static void setActive(boolean value) {
        active = value;
    }

    public static boolean isActive() {
        return active;
    }

    public static void push(String imageBase64, String imageMimeType) {
        if (imageBase64 == null || imageBase64.trim().isEmpty()) return;
        JSObject item = new JSObject();
        item.put("id", "cap_" + UUID.randomUUID().toString().replace("-", ""));
        item.put("createdAt", System.currentTimeMillis());
        item.put("imageBase64", imageBase64.trim());
        item.put("imageMimeType", imageMimeType == null || imageMimeType.trim().isEmpty() ? "image/jpeg" : imageMimeType.trim());
        QUEUE.add(item);
        while (QUEUE.size() > 10) {
            QUEUE.remove(0);
        }
    }

    public static int queueCount() {
        return QUEUE.size();
    }

    public static JSArray toJsArray() {
        JSArray array = new JSArray();
        synchronized (QUEUE) {
            for (JSObject item : QUEUE) {
                array.put(item);
            }
        }
        return array;
    }

    public static int clear() {
        int count = QUEUE.size();
        QUEUE.clear();
        return count;
    }
}
