/**
 * Command Pattern implementation for Undo/Redo system
 * M1: Supports 50 history steps
 */

import type { AnnotationData } from './types'

// Base command interface
export interface Command {
  execute(): void
  undo(): void
  // Optional: for merging similar commands (e.g., continuous dragging)
  canMerge?(other: Command): boolean
  merge?(other: Command): Command
}

// Command types for serialization
export type CommandType =
  | 'add'
  | 'remove'
  | 'modify'
  | 'changeLabel'
  | 'batch'

// History manager
export class HistoryManager {
  private undoStack: Command[] = []
  private redoStack: Command[] = []
  private maxHistory: number

  constructor(maxHistory = 50) {
    this.maxHistory = maxHistory
  }

  execute(command: Command): void {
    command.execute()
    
    // Try to merge with last command
    if (this.undoStack.length > 0) {
      const lastCommand = this.undoStack[this.undoStack.length - 1]
      if (lastCommand.canMerge?.(command)) {
        const merged = lastCommand.merge?.(command)
        if (merged) {
          this.undoStack[this.undoStack.length - 1] = merged
          this.redoStack = []
          return
        }
      }
    }

    this.undoStack.push(command)
    this.redoStack = [] // Clear redo stack on new action

    // Limit history size
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift()
    }
  }

  undo(): boolean {
    const command = this.undoStack.pop()
    if (command) {
      command.undo()
      this.redoStack.push(command)
      return true
    }
    return false
  }

  redo(): boolean {
    const command = this.redoStack.pop()
    if (command) {
      command.execute()
      this.undoStack.push(command)
      return true
    }
    return false
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }

  getUndoCount(): number {
    return this.undoStack.length
  }

  getRedoCount(): number {
    return this.redoStack.length
  }
}

// Concrete command implementations

export class AddAnnotationCommand implements Command {
  constructor(
    private annotation: AnnotationData,
    private addFn: (annotation: AnnotationData) => void,
    private removeFn: (id: string) => void
  ) {}

  execute(): void {
    this.addFn(this.annotation)
  }

  undo(): void {
    this.removeFn(this.annotation.id)
  }
}

export class RemoveAnnotationCommand implements Command {
  constructor(
    private annotation: AnnotationData,
    private addFn: (annotation: AnnotationData) => void,
    private removeFn: (id: string) => void
  ) {}

  execute(): void {
    this.removeFn(this.annotation.id)
  }

  undo(): void {
    this.addFn(this.annotation)
  }
}

export class ModifyAnnotationCommand implements Command {
  private lastModifyTime: number

  constructor(
    private annotationId: string,
    private oldData: Partial<AnnotationData>,
    private newData: Partial<AnnotationData>,
    private updateFn: (id: string, data: Partial<AnnotationData>) => void
  ) {
    this.lastModifyTime = Date.now()
  }

  execute(): void {
    this.updateFn(this.annotationId, this.newData)
  }

  undo(): void {
    this.updateFn(this.annotationId, this.oldData)
  }

  // Allow merging modifications within 500ms
  canMerge(other: Command): boolean {
    if (!(other instanceof ModifyAnnotationCommand)) return false
    if (other.annotationId !== this.annotationId) return false
    return Date.now() - this.lastModifyTime < 500
  }

  merge(other: Command): Command {
    if (!(other instanceof ModifyAnnotationCommand)) return this
    // Keep old data from this, new data from other
    return new ModifyAnnotationCommand(
      this.annotationId,
      this.oldData,
      other.newData,
      this.updateFn
    )
  }
}

export class ChangeLabelCommand implements Command {
  constructor(
    private annotationId: string,
    private oldLabelId: number,
    private newLabelId: number,
    private updateFn: (id: string, labelId: number) => void
  ) {}

  execute(): void {
    this.updateFn(this.annotationId, this.newLabelId)
  }

  undo(): void {
    this.updateFn(this.annotationId, this.oldLabelId)
  }
}

export class BatchCommand implements Command {
  constructor(private commands: Command[]) {}

  execute(): void {
    for (const cmd of this.commands) {
      cmd.execute()
    }
  }

  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo()
    }
  }
}

