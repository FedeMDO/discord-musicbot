const http = require('http')
const Discord = require('discord.js')
const {
    prefix,
    token,
} = require('./config.json')
const ytdl = require('ytdl-core')
const { getInfo } = require('ytdl-getinfo')
var server_port = process.env.YOUR_PORT || process.env.PORT || 80;
var server_host = process.env.YOUR_HOST || '0.0.0.0';
//create a server object:
http.createServer((req, res) => {
    res.write('Hello World!') //write a response to the client
    res.end() //end the response
}).listen(server_port, server_host) //the server object listens on port 8080

const client = new Discord.Client();
const queue = new Map();
client.login(token);

client.once('ready', () => {
    console.log('Ready!');
});
client.once('reconnecting', () => {
    console.log('Reconnecting!');
});
client.once('disconnect', () => {
    console.log('Disconnect!');
});

client.on('message', async message => {
    if (!message.content.startsWith(prefix)) return
   
    // Argumentos
    const args = message.content.split(/ +/);
    console.log(args) 

    // Para que no se responda a si mismo
    if (message.author.bot) return
    // No maneja mensajes que no empiece con el prefijo
    
    const serverQueue = queue.get(message.guild.id)
    if (message.content.startsWith(`${prefix} play`)) {
        // checkear que tenga un argumento
        if(args.length > 2)
            execute(message, serverQueue)
        else message.channel.send('No seas bobo, usa `xfa play [nombre de la cancion]`')
        return
    } else if (message.content.startsWith(`${prefix} skip`)) { 
        skip(message, serverQueue)
        return
    } else if (message.content.startsWith(`${prefix} stop`)) {
        stop(message, serverQueue)
        return
    } else if (message.content.startsWith(`${prefix} help`)) {
        showHelp(message)
        return
    } else if (message.content.startsWith(`${prefix} leave`)) {
        if(serverQueue){
            serverQueue.voiceChannel.leave();
            message.channel.send('Desconectado con éxito')
        } else{
            message.channel.send('No estoy en ningun canal de voz')
        }
        return
    } 
    else if (message.content.startsWith(`${prefix} saludar`)) {
        message.channel.send(`Hola ${message.author.username}! usa ``xfa play [nombre de la cancion]`` para reproducirla`)
        return
    } else {
        message.channel.send('You need to enter a valid command!')
    }
})

function showHelp(message) {
    message.channel.send(
        "Comandos:  \n`play`: Reproducir una canción o encolarla a la playlist (si se está reproduciendo otra) \n`skip`: Pasar a la siguiente canción \n`stop`: Detener la música y limpiar la playlist \n`leave`: Echar al bot del canal de voz"
        );
}

async function execute(message, serverQueue) {
	const args = message.content.slice(9)
	const voiceChannel = message.member.voiceChannel;
	if (!voiceChannel) return message.channel.send('You need to be in a voice channel to play music!');
	const permissions = voiceChannel.permissionsFor(message.client.user);
	if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
		return message.channel.send('I need the permissions to join and speak in your voice channel!');
	}

    // console.log(message.content.slice(9))
    const songInfo = await getInfo(args);
    //console.log(songInfo)
	const song = {
		title: songInfo.items[0].title,
		url: songInfo.items[0].webpage_url
	};

	if (!serverQueue) {
		const queueContruct = {
			textChannel: message.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: [],
			volume: 5,
			playing: true,
		};

		queue.set(message.guild.id, queueContruct);

		queueContruct.songs.push(song);

		try {
			var connection = await voiceChannel.join();
			queueContruct.connection = connection;
            play(message.guild, queueContruct.songs[0]);
            message.channel.send('Reproduciendo `'+ song.title + '`')
		} catch (err) {
			console.log(err);
			queue.delete(message.guild.id);
			return message.channel.send(err);
		}
	} else {
		serverQueue.songs.push(song);
		console.log(serverQueue.songs);
		return message.channel.send(`${song.title} has been added to the queue!`);
	}

}

function skip(message, serverQueue) {
	if (!message.member.voiceChannel) return message.channel.send('You have to be in a voice channel to stop the music!');
    if (!serverQueue) return message.channel.send('There is no song that I could skip!');
	serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue) {
	if (!message.member.voiceChannel) return message.channel.send('You have to be in a voice channel to stop the music!');
    if(serverQueue) {
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end();
        message.channel.send('Parando la musica y limpiando la playlist')
    } else {
        message.channel.send('No habian canciones en la playlist!');
    }
}

function play(guild, song) {
	const serverQueue = queue.get(guild.id);
	if (!song) {
		//serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		return; 
	}

	const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
		.on('end', () => {
			console.log('Music ended!');
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
		})
		.on('error', error => {
			console.error(error);
        })
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
}
