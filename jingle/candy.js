var CandyShop = (function(self) { return self; }(CandyShop || {}));

CandyShop.Jingle = (function(self, Candy, $) {
	var _connection = null,
		_ChatObserver = {
			update: function(obj, args) {
				if(args.type === 'connection') {
					switch(args.status) {
						case Strophe.Status.CONNECTING:
							Candy.Core.addHandler(_delegateJingleIq, Strophe.NS.JINGLE, 'iq', 'set');
							break;
					}
				}
			}
		},

		_delegateJingleIq = function(stanza) {
			console.log('delegate', stanza);
			var action = $(stanza).children('jingle').attr('action'),
				from = $(stanza).attr('from'),
				nickname;
			console.log(action);
			if (action === 'session-initiate') {
				if (Candy.Core.getRoom(Candy.View.getCurrent().roomJid)) {
					nickname = Candy.Core.getRoom(Candy.View.getCurrent().roomJid).getRoster().get(from).getNick();
				} else {
					nickname = Strophe.getResourceFromJid(from);
				}
				Candy.View.Pane.Chat.Modal.hide();
				Candy.View.Pane.Chat.Modal.show(Mustache.to_html(_Template.callConfirm, {
					_label: $.i18n._('labelCallConfirm', [nickname]),
					_labelYes: $.i18n._('labelYes'),
					_labelNo: $.i18n._('labelNo')
				}));
				$('#chat-modal').on('click', '#jingle-call-confirm-yes', function(e) {
					Candy.View.Pane.PrivateRoom.open(from, nickname, true, false);
					
					_onRinging(from);	
					_connection.jingle.handleSessionInit(stanza);

					Candy.View.Pane.Chat.Modal.show($.i18n._('calling'), false, true);
					return false;
				});
				$('#chat-modal').on('click', '#jingle-call-confirm-no', function(e) {
					Candy.View.Pane.Chat.Modal.hide();
					return false;
				});
			} else {
				_connection.jingle.handle(stanza);
				if (action === 'session-accept') {
					_onCalling(Candy.View.getCurrent().roomJid);
				} else if (action === 'session-terminate') {
					Candy.View.Pane.Chat.Modal.show($.i18n._('callTerminated'), true);
					_onTerminate(Candy.View.getCurrent().roomJid);
				}
			}
			return true;
		},
		
		_onRinging = function(jid) {
			$('#candy').append('<div id="jingle-videos">' 
						+ '<video width="140" height="100" id="jingle-localView" autoplay="autoplay"></video>'
						+ '<video width="230" height="150" id="jingle-remoteView" autoplay="autoplay"></video>'
						+ '</div>');
			_connection.jingle.setLocalView($('#jingle-localView'));
			_connection.jingle.setRemoteView($('#jingle-remoteView'));
			
			Candy.View.Pane.Room.getPane(Candy.View.getCurrent().roomJid, '.message-pane').addClass('jingle');
			$('#chat-tabs li[data-roomjid="' + jid + '"] .label')
				.append('<a class="jingle jingle-calling" title="' + $.i18n._('hangup') + '"></a>')
				.click(function() {
					_connection.jingle.terminate(jid);
					_onTerminate(jid);
				});
			
			$('#jingle-videos').addClass('active');
		},
		
		_onCalling = function(jid) {
			Candy.View.Pane.Chat.Modal.hide();
			$('#chat-tabs li[data-roomjid="' + jid + '"] .label .jingle').removeClass('jingle-calling');
		},
		
		_onTerminate = function(jid) {
			Candy.View.Pane.Room.getPane(Candy.View.getCurrent().roomJid, '.message-pane').removeClass('jingle');
			$('#chat-tabs li[data-roomjid="' + jid + '"] .label .jingle').remove();
			$('#jingle-videos').remove();
		},

		_applyTranslations = function() {
			Candy.View.Translation.en.labelCallConfirm = '"%s" wants a video call with you, accept?';
			Candy.View.Translation.en.labelYes = 'Yes';
			Candy.View.Translation.en.labelNo = 'No';
			Candy.View.Translation.en.calling = 'Establishing video call...';
			Candy.View.Translation.en.hangup = 'Hangup';
			Candy.View.Translation.en.callTerminated = 'Recipient terminated the call.';
		},


		_Template = {
			callConfirm: '<strong>{{_label}}</strong>'
				+ '<p><button class="button" id="jingle-call-confirm-yes">{{_labelYes}}</button> '
				+ '<button class="button" id="jingle-call-confirm-no">{{_labelNo}}</button></p>'
		};

	self.init = function(srv) {
		_applyTranslations();
		
		Candy.Core.Event.addObserver(Candy.Core.Event.KEYS.CHAT, _ChatObserver);
		_connection = Candy.Core.getConnection();
		_connection.jingle.setServer(srv);
		Candy.View.Event.Roster.onContextMenu = function(args) {
		    return {
		        'jingle': {
		            requiredPermission: function(user, me) {
		                return me.getNick() !== user.getNick() && !_connection.jingle.isBusy() &&  !Candy.Core.getUser().isInPrivacyList('ignore', user.getJid());
		            },
		            'class': 'jingle',
		            'label': 'Video call',
		            'callback': function(e, roomJid, user) {
						var rosterElem = $('#user-' + Candy.Util.jidToId(roomJid) + '-' + Candy.Util.jidToId(user.getJid()));
						Candy.View.Pane.PrivateRoom.open(rosterElem.attr('data-jid'), rosterElem.attr('data-nick'), true, false);
						
						_onRinging(user.getJid());
						
						Candy.View.Pane.Chat.Modal.show($.i18n._('calling'), false, true);
						
		                _connection.jingle.initSession(user.getJid(), 'audioVideo', 'both', function() {
							_onCalling(user.getJid());
						});
		            }
		        }
		    }
		};
	};
	
	return self;
}(CandyShop.Jingle || {}, Candy, jQuery));
