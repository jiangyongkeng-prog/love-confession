ALTER TABLE `recharges` MODIFY COLUMN `status` enum('pending','completed','approved','rejected','failed') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `recharges` ADD `screenshotUrl` text;--> statement-breakpoint
ALTER TABLE `recharges` ADD `approvedBy` int;--> statement-breakpoint
ALTER TABLE `recharges` ADD `approvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `recharges` ADD `rejectionReason` text;--> statement-breakpoint
ALTER TABLE `recharges` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;