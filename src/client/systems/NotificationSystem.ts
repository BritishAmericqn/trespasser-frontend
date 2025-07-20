import { IGameSystem } from '../../../shared/interfaces/IGameSystem';
import { GAME_CONFIG } from '../../../shared/constants/index';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  duration: number;
  timestamp: number;
  element?: Phaser.GameObjects.Container;
}

export class NotificationSystem implements IGameSystem {
  private scene: Phaser.Scene;
  private notifications: Map<string, Notification> = new Map();
  private nextId: number = 1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  initialize(): void {
    console.log('NotificationSystem: Initialized');
  }

  update(deltaTime: number): void {
    // Clean up expired notifications
    const now = Date.now();
    for (const [id, notification] of this.notifications) {
      if (now - notification.timestamp > notification.duration) {
        this.removeNotification(id);
      }
    }
  }

  destroy(): void {
    // Clean up all notifications
    for (const [id] of this.notifications) {
      this.removeNotification(id);
    }
    this.notifications.clear();
  }

  /**
   * Show a notification message
   */
  showNotification(message: string, type: NotificationType = 'info', duration: number = 3000): string {
    const id = `notification_${this.nextId++}`;
    const notification: Notification = {
      id,
      message,
      type,
      duration,
      timestamp: Date.now()
    };

    // Create the visual element
    notification.element = this.createNotificationElement(notification);
    
    // Store the notification
    this.notifications.set(id, notification);

    // Position notifications vertically
    this.repositionNotifications();

    console.log(`📢 ${type.toUpperCase()}: ${message}`);
    return id;
  }

  /**
   * Remove a specific notification
   */
  removeNotification(id: string): void {
    const notification = this.notifications.get(id);
    if (notification && notification.element) {
      // Fade out animation
      this.scene.tweens.add({
        targets: notification.element,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          notification.element?.destroy();
        }
      });
    }
    this.notifications.delete(id);
    
    // Reposition remaining notifications
    this.repositionNotifications();
  }

  /**
   * Clear all notifications
   */
  clearAll(): void {
    for (const [id] of this.notifications) {
      this.removeNotification(id);
    }
  }

  private createNotificationElement(notification: Notification): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0);
    container.setDepth(10000); // Very high depth to show above everything

    // Background colors based on type
    const colors = {
      success: 0x4CAF50,
      error: 0xf44336,
      warning: 0xFF9800,
      info: 0x2196F3
    };

    const bgColor = colors[notification.type] || colors.info;

    // Calculate text dimensions
    const textStyle = {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'monospace',
      align: 'center'
    };

    const tempText = this.scene.add.text(0, 0, notification.message, textStyle);
    const textWidth = tempText.width;
    const textHeight = tempText.height;
    tempText.destroy();

    // Background
    const padding = 8;
    const bgWidth = Math.min(textWidth + padding * 2, GAME_CONFIG.GAME_WIDTH - 40);
    const bgHeight = textHeight + padding * 2;

    const background = this.scene.add.rectangle(0, 0, bgWidth, bgHeight, bgColor);
    background.setStrokeStyle(1, 0xffffff, 0.3);
    container.add(background);

    // Text
    const text = this.scene.add.text(0, 0, notification.message, textStyle);
    text.setOrigin(0.5, 0.5);
    text.setWordWrapWidth(bgWidth - padding * 2);
    container.add(text);

    // Position at top center
    container.setPosition(GAME_CONFIG.GAME_WIDTH / 2, 30);

    // Fade in animation
    container.setAlpha(0);
    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      duration: 300,
      ease: 'Power2'
    });

    return container;
  }

  private repositionNotifications(): void {
    let yOffset = 30;
    const spacing = 35;

    for (const notification of this.notifications.values()) {
      if (notification.element) {
        // Animate to new position
        this.scene.tweens.add({
          targets: notification.element,
          y: yOffset,
          duration: 200,
          ease: 'Power2'
        });
        yOffset += spacing;
      }
    }
  }

  /**
   * Convenience methods for different notification types
   */
  success(message: string, duration?: number): string {
    return this.showNotification(message, 'success', duration);
  }

  error(message: string, duration?: number): string {
    return this.showNotification(message, 'error', duration);
  }

  warning(message: string, duration?: number): string {
    return this.showNotification(message, 'warning', duration);
  }

  info(message: string, duration?: number): string {
    return this.showNotification(message, 'info', duration);
  }
} 