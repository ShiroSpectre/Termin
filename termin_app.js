const fs = require('fs');
const Discord = require('discord.js');
const client = new Discord.Client();

const config = require('./config.json');
const prefix = config.prefix;

var lastMessage = parseInt(Date.now()/1000) - 86400
var lastChannel = null;

client.once('ready', () => {
	console.log('Ready!');
	client.user.setActivity('.termin <Bezeichnung>', { type: 'LISTENING' });
});

client.on('message', message => {
	if (!message.content.startsWith(prefix) || message.author.bot) return;
	
	const args = message.content.slice(prefix.length).trim().split(' ');
	const command = args.shift().toLowerCase();
	const channel = message.channel;

	if (command === 'termin') init_terminfindung(args, channel)
	if (command === 'leaderboard') show_leaderboard(channel)

	message.delete({ timeout: 10000 }).catch(error => {
		console.log('ERROR:' + error);
	});
});

async function init_terminfindung(args, channel) {
	const refresh = 300 // 300 (s)
	var remindArg = 86400 // 86400 (s)
	const mention = 3600 // 3600 (s)
	const roleID = '579286739647201296'  // 579286739647201296 - rict // 839549248038895636 = testrolle

	// Änderung
	if (args.length === 0) {
		channel.send('Keine Bezeichnung des Termins angegeben').then(msg => {
			msg.delete({ timeout: 5000}).catch(error => {
				console.log('ERROR:' + error);
			});
		})
		return;
	}

	if ((parseInt(Date.now()/1000) - lastMessage) > mention || channel !== lastChannel) {
		channel.send(`<@&${roleID}>`).catch(error => {
			console.log('ERROR:' + error);
		});
		lastMessage = parseInt(Date.now()/1000);
		lastChannel = channel;
	}

	args.forEach(function (item) {
		if (item.startsWith('!')) {
			remindArg = parseInt(item.replace("!", ""))*3600;
			if (isNaN(remindArg)) remindArg = 86400
			args = args.filter(e => e !== item)
		}
	});

	var remindIntervall = remindArg;
	var remindTime = remindArg;
	const startTime = parseInt(Date.now()/1000);

	const title = '**' + args.join(' ') + '**'
	var memberCollection = channel.guild.roles.cache.get('868171992023588934').members.map(m=>m.user); // 868171992023588934 - Terminerinnerung // 839549248038895636 = testrolle
	var missingUsernames = memberCollection.map(m=>m.username);
	var maybeCollection = memberCollection;

	try {
		const data = fs.readFileSync('leaderboard.json');
		playerArray = JSON.parse(data);
		if (playerArray.length === 0) {
			var rictMembers = channel.guild.roles.cache.get(roleID).members.map(m=>m.user);
			var rictUsernames = rictMembers.map(m=>m.username);
			init_leaderboard(playerArray, rictUsernames);
		}
	} catch (err) {
		console.error(err)
	}
	
	const total = missingUsernames.length;
	var timeleft = Math.round( ((remindTime - (parseInt(Date.now()/1000) - startTime))/3600) * 10) / 10
	const Embed = new Discord.MessageEmbed()
	.setColor('#000066')
	.setDescription(`${title}\n*missing votes: ${total}/${total} | reminder in ${timeleft} h*`)
	const message = await channel.send(Embed).catch(error => {
		console.log('ERROR:' + error);
	});;

	const interval = setInterval(function () {
		let reactions = message.reactions.cache;
		for (let [emoji, value] of reactions.entries()) {
			usercache = value.users.cache
			for (let [key, value] of usercache.entries()) {
				username = value.username
				memberCollection = memberCollection.filter(function(user) { if (user.username !== username ) return user})
				if (emoji === '❌') {
					clearInterval(interval)
					const Embed = new Discord.MessageEmbed()
					.setColor('#0099ff')
					.setDescription('Termin gelöscht')
					message.edit(Embed).catch(error => {
						console.log('ERROR:' + error);
					});
					
					return
				}
			}
		}

		missingUsernames = memberCollection.map(m=>m.username);
		var remaining = missingUsernames.length;

		timeleft = Math.round( ((remindTime - (parseInt(Date.now()/1000) - startTime))/3600) * 10) / 10
		const Embed = new Discord.MessageEmbed()
		.setColor('#000066')
		.setDescription(`${title}\n*missing votes: ${remaining}/${total} | reminder in ${timeleft} h*`)
		message.edit(Embed).catch(error => {
			console.log('ERROR:' + error);
		});

		if (missingUsernames.length === 0 || remindIntervall < 3500) { //3500
			const Embed = new Discord.MessageEmbed()
			.setColor('#000066')
			.setDescription(title)
			message.edit(Embed).catch(error => {
				console.log('ERROR:' + error);
			});

			maybeUsernames = []
			let reactions = message.reactions.cache;
			for (let [emoji, value] of reactions.entries()) {
				usercache = value.users.cache
				for (let [key, value] of usercache.entries()) {
					if (emoji === '🤏') {
						maybeUsernames.push(value.username)
					}
				}
			}
			maybeCollection = maybeCollection.filter(function(user) { if (maybeUsernames.includes(user.username)) return user})
			if (maybeCollection.length > 0) {
				maybeCollection.forEach(async function (user) {
					if (!user.bot) await user.send(`🤏 Eintragung beim Termin: **${title}** in ${channel} -> *adding point to leaderboard*`)
					await Sleep(5000);
				})

				add_point_to_leaderboard(maybeUsernames);
			}

			clearInterval(interval);
			return
		}

		if ((parseInt(Date.now()/1000) - startTime) >= remindTime) {
			sendRemindMessage(memberCollection, title, channel);
			add_point_to_leaderboard(missingUsernames);
			
			remindIntervall = remindIntervall/2
			remindTime += remindIntervall;
		}
	}, refresh*1000);
}

function sendRemindMessage(memberCollection, title, channel) {
	memberCollection.forEach(async function (user) {
		if (!user.bot) await user.send(`Fehlende Eintragung beim Termin: **${title}** in ${channel} -> *adding point to leaderboard*`)
		await Sleep(5000);
	})
}

function show_leaderboard(channel) {
	try {
		const data = fs.readFileSync('leaderboard.json');
		playerArray = JSON.parse(data);
		playerArray.sort(compare);
		if (playerArray.length === 0) playerArray.push({id: 'Bitte erst Terminbefehl benutzen', score: 0})

		const Embed = new Discord.MessageEmbed()
		.setColor('#000066')
		.setTitle('Leaderboard')
		.addFields(
			{ name: 'name', value: playerArray.map(m=>m.id), inline: true },
			{ name: 'score', value: playerArray.map(m=>m.score), inline: true },
		)
		channel.send(Embed);
	} catch (err) {
		console.error(err)
	}
}

function init_leaderboard(playerArray, missingUsernames) {
	missingUsernames.forEach(element => {
		playerArray.push({id: element, score: 0})
	});
	try {
		fs.writeFileSync('leaderboard.json', JSON.stringify(playerArray))
	} catch (err) {
		console.error(err)
	}
}

function add_point_to_leaderboard(missingUsernames) {
	try {
		const data = fs.readFileSync('leaderboard.json');
		playerArray = JSON.parse(data);

		missingUsernames.forEach(element => {
			index = playerArray.findIndex(x => x.id === element)
			playerArray[index].score = playerArray[index].score + 1
		});

		fs.writeFileSync('leaderboard.json', JSON.stringify(playerArray))
	} catch (err) {
		console.error(err)
	}
}

function compare(a,b) { return b.score - a.score }

function Sleep(milliseconds) {
	return new Promise(resolve => setTimeout(resolve, milliseconds));
}

process.on('unhandledRejection', error => {
	console.error('Unhandled promise rejection:', error);
});


client.login(config.discord_token);