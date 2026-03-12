ALTER TABLE `users` MODIFY COLUMN `username` varchar(64);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `password` text;--> statement-breakpoint
ALTER TABLE `users` ADD `openId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `loginMethod` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_openId_unique` UNIQUE(`openId`);