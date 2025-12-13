import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Keyboard, MousePointer2, Move, ZoomIn } from "lucide-react"

interface ShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ShortcutGroup {
  title: string
  icon: React.ElementType
  items: {
    label: string
    keys: string[]
  }[]
}

const shortcuts: ShortcutGroup[] = [
  {
    title: "通用",
    icon: Keyboard,
    items: [
      { label: "显示快捷键", keys: ["?"] },
      { label: "保存", keys: ["⌘/Ctrl", "S"] },
      { label: "撤销", keys: ["⌘/Ctrl", "Z"] },
      { label: "重做", keys: ["⌘/Ctrl", "⇧/Shift", "Z"] },
    ],
  },
  {
    title: "画布操作",
    icon: Move,
    items: [
      { label: "平移画布", keys: ["Space", "+", "Drag"] },
      { label: "缩放", keys: ["Scroll"] },
      { label: "放大 / 缩小", keys: ["+", "-"] },
      { label: "适应屏幕", keys: ["0"] },
    ],
  },
  {
    title: "标注工具",
    icon: MousePointer2,
    items: [
      { label: "选择工具", keys: ["V"] },
      { label: "矩形工具", keys: ["R"] },
      { label: "多边形工具", keys: ["P"] },
      { label: "删除选中", keys: ["Del/Backspace"] },
      { label: "取消选择", keys: ["Esc"] },
    ],
  },
  {
    title: "导航与提交",
    icon: ZoomIn,
    items: [
      { label: "提交并下一张", keys: ["Space", "Enter"] },
      { label: "上一张", keys: ["←"] },
      { label: "下一张", keys: ["→"] },
      { label: "跳过", keys: ["S"] },
      { label: "删除图片", keys: ["⌘/Ctrl", "Del"] },
    ],
  },
]

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            快捷键指南
          </DialogTitle>
          <DialogDescription>
            支持 Windows 和 Mac 键盘快捷键，提高标注效率
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {shortcuts.map((group) => (
            <div key={group.title} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground pb-2 border-b">
                <group.icon className="w-4 h-4" />
                {group.title}
              </div>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span className="text-foreground/80">{item.label}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, i) => (
                        <kbd
                          key={i}
                          className="pointer-events-none h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground flex min-w-[1.5em] justify-center"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
