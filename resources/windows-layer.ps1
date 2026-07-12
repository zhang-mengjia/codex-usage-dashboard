param(
  [Parameter(Mandatory = $true)][Int64]$Handle,
  [ValidateSet("desktop", "normal", "query", "refresh")][string]$Mode = "query"
)

$source = @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class CodexUsageWindowLayer {
    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);

    [DllImport("user32.dll")]
    private static extern IntPtr GetParent(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr FindWindow(string className, string windowName);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr FindWindowEx(IntPtr parent, IntPtr childAfter, string className, string windowName);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam, uint flags, uint timeout, out IntPtr result);

    [DllImport("user32.dll")]
    private static extern bool SetWindowPos(IntPtr hWnd, IntPtr insertAfter, int x, int y, int cx, int cy, uint flags);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int command);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetClassName(IntPtr hWnd, StringBuilder className, int maxCount);

    [DllImport("user32.dll")]
    private static extern bool IsWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("kernel32.dll")]
    private static extern void SetLastError(uint errorCode);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")]
    private static extern IntPtr GetWindowLongPtr(IntPtr hWnd, int index);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")]
    private static extern IntPtr SetWindowLongPtr(IntPtr hWnd, int index, IntPtr newValue);

    [DllImport("user32.dll")]
    private static extern bool RedrawWindow(IntPtr hWnd, IntPtr updateRect, IntPtr updateRegion, uint flags);

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

    [DllImport("user32.dll")]
    private static extern IntPtr WindowFromPoint(POINT point);

    [DllImport("user32.dll")]
    private static extern IntPtr GetAncestor(IntPtr hWnd, uint flags);

    [DllImport("user32.dll")]
    private static extern uint GetDpiForWindow(IntPtr hWnd);

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT { public int X; public int Y; }

    private static readonly IntPtr HWND_TOP = IntPtr.Zero;
    private static readonly IntPtr HWND_BOTTOM = new IntPtr(1);
    private const uint SWP_NOSIZE = 0x0001;
    private const uint SWP_NOMOVE = 0x0002;
    private const uint SWP_NOACTIVATE = 0x0010;
    private const uint SWP_FRAMECHANGED = 0x0020;
    private const uint SMTO_NORMAL = 0x0000;
    private const int SW_SHOWNOACTIVATE = 4;
    private const int GWL_STYLE = -16;
    private const int GWL_EXSTYLE = -20;
    private const int GWLP_HWNDPARENT = -8;
    private const long WS_CHILD = 0x40000000L;
    private const long WS_POPUP = unchecked((long)0x80000000L);
    private const uint GA_ROOT = 2;
    private const uint WM_NCHITTEST = 0x0084;
    private const long WS_EX_TRANSPARENT = 0x00000020L;
    private const uint RDW_INVALIDATE = 0x0001;
    private const uint RDW_ERASE = 0x0004;
    private const uint RDW_ALLCHILDREN = 0x0080;
    private const uint RDW_UPDATENOW = 0x0100;
    private const uint RDW_FRAME = 0x0400;

    private static IntPtr FindDesktopHost() {
        IntPtr progman = FindWindow("Progman", null);
        if (progman != IntPtr.Zero) {
            IntPtr result;
            SendMessageTimeout(progman, 0x052C, IntPtr.Zero, IntPtr.Zero, SMTO_NORMAL, 1000, out result);
        }

        IntPtr worker = IntPtr.Zero;
        EnumWindows(delegate(IntPtr top, IntPtr param) {
            IntPtr shellView = FindWindowEx(top, IntPtr.Zero, "SHELLDLL_DefView", null);
            if (shellView != IntPtr.Zero) {
                IntPtr candidate = FindWindowEx(IntPtr.Zero, top, "WorkerW", null);
                if (candidate != IntPtr.Zero) worker = candidate;
            }
            return true;
        }, IntPtr.Zero);
        return worker != IntPtr.Zero ? worker : progman;
    }

    private static string ClassName(IntPtr handle) {
        if (handle == IntPtr.Zero) return "";
        StringBuilder value = new StringBuilder(256);
        GetClassName(handle, value, value.Capacity);
        return value.ToString();
    }

    private static void RefreshDesktop() {
        uint flags = RDW_INVALIDATE | RDW_ERASE | RDW_ALLCHILDREN | RDW_UPDATENOW | RDW_FRAME;
        IntPtr progman = FindWindow("Progman", null);
        if (progman != IntPtr.Zero) RedrawWindow(progman, IntPtr.Zero, IntPtr.Zero, flags);
        EnumWindows(delegate(IntPtr top, IntPtr param) {
            string className = ClassName(top);
            if (className == "WorkerW" || className == "Progman") {
                RedrawWindow(top, IntPtr.Zero, IntPtr.Zero, flags);
            }
            return true;
        }, IntPtr.Zero);
    }

    public static string Apply(long rawHandle, string mode) {
        IntPtr handle = new IntPtr(rawHandle);
        IntPtr target = IntPtr.Zero;
        int lastError = 0;
        if (mode == "refresh") {
            RefreshDesktop();
        } else if (mode == "desktop") {
            target = FindDesktopHost();
            if (target == IntPtr.Zero) throw new InvalidOperationException("Desktop host window was not found.");
            long style = GetWindowLongPtr(handle, GWL_STYLE).ToInt64();
            SetParent(handle, IntPtr.Zero);
            SetWindowLongPtr(handle, GWL_STYLE, new IntPtr((style & ~WS_CHILD) | WS_POPUP));
            SetLastError(0);
            SetWindowLongPtr(handle, GWLP_HWNDPARENT, target);
            lastError = Marshal.GetLastWin32Error();
            ShowWindow(handle, SW_SHOWNOACTIVATE);
            SetWindowPos(handle, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED);
        } else if (mode == "normal") {
            SetLastError(0);
            SetParent(handle, IntPtr.Zero);
            long style = GetWindowLongPtr(handle, GWL_STYLE).ToInt64();
            SetWindowLongPtr(handle, GWL_STYLE, new IntPtr((style & ~WS_CHILD) | WS_POPUP));
            SetWindowLongPtr(handle, GWLP_HWNDPARENT, IntPtr.Zero);
            lastError = Marshal.GetLastWin32Error();
            ShowWindow(handle, SW_SHOWNOACTIVATE);
            SetWindowPos(handle, HWND_TOP, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED);
            RefreshDesktop();
        }

        IntPtr parent = GetParent(handle);
        if (mode == "desktop" && parent == target) lastError = 0;
        uint processId;
        GetWindowThreadProcessId(handle, out processId);
        RECT rect;
        bool hasRect = false;
        IntPtr hit = IntPtr.Zero;
        IntPtr hitRoot = IntPtr.Zero;
        uint hitProcessId = 0;
        long hitTestCode = 0;
        bool acceptsHit = false;
        long extendedStyle = GetWindowLongPtr(handle, GWL_EXSTYLE).ToInt64();
        if (GetWindowRect(handle, out rect)) {
            hasRect = true;
            POINT center = new POINT { X = rect.Left + (rect.Right - rect.Left) / 2, Y = rect.Top + (rect.Bottom - rect.Top) / 2 };
            hit = WindowFromPoint(center);
            hitRoot = GetAncestor(hit, GA_ROOT);
            GetWindowThreadProcessId(hit, out hitProcessId);
            long packedPoint = (long)(ushort)center.X | ((long)(ushort)center.Y << 16);
            IntPtr hitTestResult;
            SendMessageTimeout(handle, WM_NCHITTEST, IntPtr.Zero, new IntPtr(packedPoint), SMTO_NORMAL, 1000, out hitTestResult);
            hitTestCode = hitTestResult.ToInt64();
            acceptsHit = hitTestCode != 0 && hitTestCode != -1 && (extendedStyle & WS_EX_TRANSPARENT) == 0;
        }
        int width = hasRect ? rect.Right - rect.Left : 0;
        int height = hasRect ? rect.Bottom - rect.Top : 0;
        return "{\"handle\":\"" + rawHandle + "\",\"isWindow\":" + (IsWindow(handle) ? "true" : "false") + ",\"windowClass\":\"" + ClassName(handle) + "\",\"processId\":" + processId + ",\"dpi\":" + GetDpiForWindow(handle) + ",\"targetHandle\":\"" + target.ToInt64() + "\",\"targetClass\":\"" + ClassName(target) + "\",\"parentHandle\":\"" + parent.ToInt64() + "\",\"parentClass\":\"" + ClassName(parent) + "\",\"left\":" + (hasRect ? rect.Left : 0) + ",\"top\":" + (hasRect ? rect.Top : 0) + ",\"width\":" + width + ",\"height\":" + height + ",\"hitHandle\":\"" + hit.ToInt64() + "\",\"hitRootHandle\":\"" + hitRoot.ToInt64() + "\",\"hitProcessId\":" + hitProcessId + ",\"hitMatchesWindow\":" + (hitRoot == handle ? "true" : "false") + ",\"hitTestCode\":" + hitTestCode + ",\"acceptsHit\":" + (acceptsHit ? "true" : "false") + ",\"exTransparent\":" + ((extendedStyle & WS_EX_TRANSPARENT) != 0 ? "true" : "false") + ",\"lastError\":" + lastError + ",\"mode\":\"" + mode + "\"}";
    }
}
"@

Add-Type -TypeDefinition $source -Language CSharp
[CodexUsageWindowLayer]::Apply($Handle, $Mode)
