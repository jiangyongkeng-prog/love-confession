CREATE TABLE `confessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`herName` varchar(100) NOT NULL,
	`title` text,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `confessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`confessionId` int NOT NULL,
	`title` varchar(100),
	`description` text,
	`photoUrl` text NOT NULL,
	`photoKey` text NOT NULL,
	`mimeType` varchar(50) DEFAULT 'image/jpeg',
	`fileSize` int,
	`order` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `photos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reasons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`confessionId` int NOT NULL,
	`content` text NOT NULL,
	`order` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reasons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `storyEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`confessionId` int NOT NULL,
	`title` varchar(100) NOT NULL,
	`content` text NOT NULL,
	`icon` varchar(10) DEFAULT '✦',
	`order` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `storyEntries_id` PRIMARY KEY(`id`)
);
