;(function (window, document, $, undefined) {
    'use strict';

    // If there's no jQuery, fancyBox can't work
    // =========================================

    if ( !$ ) {
        return undefined;
    }

    // Private default settings
    // ========================

    var defaults = {

        // Animation duration in ms
        speed : 330,

        // Enable infinite gallery navigation
        loop : true,

        // Should zoom animation change opacity, too
        // If opacity is 'auto', then fade-out if image and thumbnail have different aspect ratios
        opacity : 'auto',

        // Space around image, ignored if zoomed-in or viewport smaller than 800px
        margin : [44, 0],

        // Horizontal space between slides
        gutter : 30,

        // Should display toolbars
        infobar : true,
        buttons : true,

        // What buttons should appear in the toolbar
        slideShow  : true,
        fullScreen : true,
        thumbs     : true,
        closeBtn   : true,

        // Should apply small close button at top right corner of the content
        // If 'auto' - will be set for content having type 'html', 'inline' or 'ajax'
        smallBtn : 'auto',

        image : {

            // Wait for images to load before displaying
            // Requires predefined image dimensions
            // If 'auto' - will zoom in thumbnail if 'width' and 'height' attributes are found
            preload : "auto",

            // Protect an image from downloading by right-click
            protect : false

        },

        ajax : {

            // Object containing settings for ajax request
            settings : {

                // This helps to indicate that request comes from the modal
                // Feel free to change naming
                data : {
                    fancybox : true
                }
            }

        },

        iframe : {

            // Iframe template
            tpl : '<iframe id="fancybox-frame{rnd}" name="fancybox-frame{rnd}" class="fancybox-iframe" frameborder="0" vspace="0" hspace="0" webkitAllowFullScreen mozallowfullscreen allowFullScreen allowtransparency="true" src=""></iframe>',

            // Preload iframe before displaying it
            // This allows to calculate iframe content width and height
            // (note: Due to "Same Origin Policy", you can't get cross domain data).
            preload : true,

            // Scrolling attribute for iframe tag
            scrolling : 'no',

            // Custom CSS styling for iframe wrapping element
            css : {}

        },

        // Custom CSS class for layout
        baseClass : '',

        // Custom CSS class for slide element
        slideClass : '',

        // Base template for layout
        baseTpl	: '<div class="fancybox-container" role="dialog" tabindex="-1">' +
                '<div class="fancybox-bg"></div>' +
                '<div class="fancybox-controls">' +
                    '<div class="fancybox-infobar">' +
                        '<button data-fancybox-previous class="fancybox-button fancybox-button--left" title="Previous"></button>' +
                        '<div class="fancybox-infobar__body">' +
                            '<span class="js-fancybox-index"></span>&nbsp;/&nbsp;<span class="js-fancybox-count"></span>' +
                        '</div>' +
                        '<button data-fancybox-next class="fancybox-button fancybox-button--right" title="Next"></button>' +
                    '</div>' +
                    '<div class="fancybox-buttons">' +
                        '<button data-fancybox-close class="fancybox-button fancybox-button--close" title="Close (Esc)"></button>' +
                    '</div>' +
                '</div>' +
                '<div class="fancybox-slider-wrap">' +
                    '<div class="fancybox-slider"></div>' +
                '</div>' +
                '<div class="fancybox-caption-wrap"><div class="fancybox-caption"></div></div>' +
            '</div>',

        // Loading indicator template
        spinnerTpl : '<div class="fancybox-loading"></div>',

        // Error message template
        errorTpl : '<div class="fancybox-error"><p>The requested content cannot be loaded. <br /> Please try again later.<p></div>',

        // This will be appended to html content, if "smallBtn" option is not set to false
        closeTpl : '<button data-fancybox-close class="fancybox-close-small">×</button>',

        // Container is injected into this element
        parentEl : 'body',

        // Enable gestures (tap, zoom, pan and pinch)
        touch : true,

        // Enable keyboard navigation
        keyboard : true,

        // Try to focus on first focusable element after opening
        focus : true,

        // Close when clicked outside of the content
        closeClickOutside : true,

        // Callbacks
        beforeLoad	 : $.noop,
        afterLoad    : $.noop,
        beforeMove 	 : $.noop,
        afterMove    : $.noop,
        onComplete	 : $.noop,

        onInit       : $.noop,
        beforeClose	 : $.noop,
        afterClose	 : $.noop,
        onActivate   : $.noop,
        onDeactivate : $.noop

    };

    var $W = $(window);
    var $D = $(document);

    var called = 0;

    // Check if an object is a jQuery object and not a native JavaScript object
    // ========================================================================

    var isQuery = function (obj) {
        return obj && obj.hasOwnProperty && obj instanceof $;
    };

    // Handle multiple browsers for requestAnimationFrame()
    // ====================================================

    var requestAFrame = (function() {
        return  window.requestAnimationFrame ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame ||
                function( callback ) {
                    window.setTimeout(callback, 1000 / 60); };
                })();


    // Check if element is inside the viewport by at least 1 pixel
    // ===========================================================

    var isElementInViewport = function( el ) {
        var rect;

        if ( typeof $ === "function" && el instanceof $ ) {
            el = el[0];
        }

        rect = el.getBoundingClientRect();

        return rect.bottom > 0 &&
                rect.right > 0 &&
                rect.left < (window.innerWidth || document.documentElement.clientWidth)  &&
                rect.top < (window.innerHeight || document.documentElement.clientHeight);
    };


    // Class definition
    // ================

    var FancyBox = function( content, opts, index ) {
        var self = this;

        self.opts  = $.extend( true, { index : index }, defaults, opts || {} );
        self.id    = self.opts.id || ++called;
        self.group = [];

        self.currIndex = parseInt( self.opts.index, 10 ) || 0;
        self.prevIndex = null;

        self.prevPos = null;
        self.currPos = 0;

        self.firstRun = null;

        // Create group elements from original item collection
        self.createGroup( content );

        if ( !self.group.length ) {
            return;
        }

        // Save last active element and current scroll position
        self.$lastFocus = $(document.activeElement).blur();

        // Collection of interface DOM elements
        self.elems = {};

        // Collection of gallery objects
        self.slides = {};

        self.init( content );

    };

    $.extend(FancyBox.prototype, {

        // Create DOM structure
        // ====================

        init : function() {
            var self = this;

            var testWidth;
            var $container;

            self.scrollTop  = $W.scrollTop();
            self.scrollLeft = $W.scrollLeft();

            // Disable compensating on touch-enabled devices as they probably do not have scrollbars anyway
            // and therefore we avoid of unnecessary layout reflow
            if ( !$.fancybox.isTouch && !$( 'html' ).hasClass( 'fancybox-enabled' ) ) {
                testWidth = $( 'body' ).width();

                $( 'html' ).addClass( 'fancybox-enabled' );

                testWidth = $( 'body' ).width() - testWidth;

                // Body width has increased - compensate missing scrollbars
                if ( testWidth > 1 ) {
                    $( '<style id="fancybox-noscroll" type="text/css">' ).html( '.compensate-for-scrollbar, .fancybox-enabled body { margin-right: ' + testWidth + 'px; }' ).appendTo( 'head' );
                }

            }

            $container = $( self.opts.baseTpl )
                .attr('id', 'fancybox-container-' + self.id)
                .data( 'FancyBox', self )
                .addClass( self.opts.baseClass )
                .hide()
                .prependTo( self.opts.parentEl );

            // Create object holding references to jQuery wrapped nodes
            self.$refs = {
                container   : $container,
                bg          : $container.find('.fancybox-bg'),
                controls    : $container.find('.fancybox-controls'),
                buttons     : $container.find('.fancybox-buttons'),
                slider_wrap : $container.find('.fancybox-slider-wrap'),
                slider      : $container.find('.fancybox-slider'),
                caption     : $container.find('.fancybox-caption')
            };

            self.trigger( 'onInit' );

            // Bring to front and enable events
            self.activate();

            // Try to avoid running multiple times
            if ( self.current ) {
                return;
            }

            self.jumpTo( self.currIndex );

        },


        // Create array of gally item objects
        // Check if each object has valid type and content
        // ===============================================

        createGroup : function ( content ) {
            var self  = this;
            var items = $.makeArray( content );

            $.each(items, function( i, item ) {
                var obj  = {},
                    opts = {},
                    data = [],
                    $item,
                    type,
                    src,
                    srcParts;

                // Step 1 - Make sure we have an object

                if ( $.isPlainObject( item ) ) {

                    obj  = item;
                    opts = item.opts || {};

                } else if ( $.type( item ) === 'object' && $( item ).length ) {

                    $item = $( item );
                    data  = $item.data();

                    opts = 'options' in data ? data.options : {};

                    opts = $.type( opts ) === 'object' ? opts : {};

                    obj.type = 'type' in data ? data.type : opts.type;
                    obj.src  = 'src'  in data ? data.src  : ( opts.src || $item.attr( 'href' ) );

                    opts.width   = 'width'   in data ? data.width   : opts.width;
                    opts.height  = 'height'  in data ? data.height  : opts.height;
                    opts.thumb   = 'thumb'   in data ? data.thumb   : opts.thumb;

                    opts.selector = 'selector'  in data ? data.selector  : opts.selector;

                    if ( 'srcset' in data ) {
                        opts.image = { srcset : data.srcset };
                    }

                    opts.$orig = $item;

                } else {

                    obj = {
                        type    : 'html',
                        content : item + ''
                    };

                }

                obj.opts = $.extend( true, {}, self.opts, opts );

                // Step 2 - Make sure we have supported content type

                type = obj.type;
                src  = obj.src || '';

                if ( !type ) {

                    if ( obj.content ) {
                        type = 'html';

                    } else if ( src.match(/(^data:image\/[a-z0-9+\/=]*,)|(\.(jp(e|g|eg)|gif|png|bmp|webp|svg|ico)((\?|#).*)?$)/i) ) {
                        type = 'image';

                    } else if ( src.match(/\.(pdf)((\?|#).*)?$/i) ) {
                        type = 'pdf';

                    } else if ( src.charAt(0) === '#' ) {
                        type = 'inline';

                    }

                    obj.type = type;

                }

                // Step 3 - Some adjustments

                obj.index = self.group.length;

                // Check if $orig and $thumb objects exist
                if ( obj.opts.$orig && !obj.opts.$orig.length ) {
                    delete obj.opts.$orig;
                }

                if ( !obj.opts.$thumb && obj.opts.$orig ) {
                    obj.opts.$thumb = obj.opts.$orig.find( 'img:first' );
                }

                if ( obj.opts.$thumb && !obj.opts.$thumb.length ) {
                    delete obj.opts.$thumb;
                }

                // Caption is a "special" option, it can be passed as a method
                if ( $.type( obj.opts.caption ) === 'function' ) {
                    obj.opts.caption = obj.opts.caption.apply( item, [ self, obj ] );

                } else if ( 'caption' in data ) {
                    obj.opts.caption = data.caption;

                } else if ( opts.$orig ) {
                    obj.opts.caption = $item.attr( 'title' );
                }

                // Make sure we have caption as a string
                obj.opts.caption = obj.opts.caption === undefined ? '' : obj.opts.caption + '';

                // Check if url contains selector used to filter the content
                // Example: "ajax.html #something"
                if ( type === 'ajax' ) {
                    srcParts = src.split(/\s+/, 2);

                    if ( srcParts.length > 1 ) {
                        obj.src = srcParts.shift();

                        obj.opts.selector = srcParts.shift();
                    }
                }

                if ( obj.opts.smallBtn == 'auto' ) {

                    if ( $.inArray( type, ['html', 'inline', 'ajax'] ) > -1 ) {
                        obj.opts.buttons  = false;
                        obj.opts.smallBtn = true;

                    } else {
                        obj.opts.smallBtn = false;
                    }

                }

                if ( type === 'pdf' ) {

                    obj.type = 'iframe';

                    obj.opts.closeBtn = true;
                    obj.opts.smallBtn = false;

                    obj.opts.iframe.preload = false;

                }

                if ( obj.opts.modal ) {

                    $.extend(true, obj.opts, {
                        infobar		: 0,
                        buttons		: 0,
                        keyboard	: 0,
                        slideShow	: 0,
                        fullScreen	: 0,
                        closeClickOutside	: 0
                    });

                }

                self.group.push( obj );

            });

        },


        // Attach an event handler functions for:
        //   - navigation elements
        //   - browser scrolling, resizing;
        //   - focusing
        //   - keyboard
        // =================

        addEvents : function() {
            var self = this;

            var runUpdate = function () {

                $W.scrollTop( self.scrollTop ).scrollLeft( self.scrollLeft );

                self.$refs.slider_wrap.show();

                self.update();

            };

            self.removeEvents();


            // Make navigation elements clickable

            self.$refs.container.on('click.fb-close', '[data-fancybox-close]', function(e) {
                e.stopPropagation();
                e.preventDefault();

                self.close( e );

            }).on('click.fb-previous', '[data-fancybox-previous]', function(e) {
                e.stopPropagation();
                e.preventDefault();

                self.previous();

            }).on('click.fb-next', '[data-fancybox-next]', function(e) {
                e.stopPropagation();
                e.preventDefault();

                self.next();
            });


            // Handle page scrolling and browser resizing

            $( window ).on('orientationchange.fb resize.fb', function(e) {
                requestAFrame(function() {

                    if ( e && e.originalEvent && e.originalEvent.type == "orientationchange" ) {
                        self.$refs.slider_wrap.hide();

                        requestAFrame( runUpdate );

                    } else {

                        runUpdate();
                    }

                });

            });


            // Trap focus

            $D.on('focusin.fb', function(e) {
                var instance = $.fancybox ? $.fancybox.getInstance() : null;

                if ( instance && !$( e.target ).hasClass( 'fancybox-container' ) && !$.contains( instance.$refs.container[0], e.target ) ) {
                    e.stopPropagation();

                    instance.focus();

                    // Sometimes page gets scrolled, set it back
                    $W.scrollTop( self.scrollTop ).scrollLeft( self.scrollLeft );
                }

            });


            // Enable keyboard navigation

            $( document ).on('keydown.fb', function (e) {
                var current = self.current,
                    keycode = e.keyCode || e.which;

                if ( !current || !current.opts.keyboard ) {
                    return;
                }

                if ( $(e.target).is('input') || $(e.target).is('textarea') ) {
                    return;
                }

                // Backspace and Esc keys
                if ( keycode === 8 || keycode === 27 ) {
                    e.preventDefault();

                    self.close();

                    return;
                }

                switch ( keycode ) {

                    case 37: // Left arrow
                    case 38: // Up arrow

                        e.preventDefault();

                        self.previous();

                    break;

                    case 39: // Right arrow
                    case 40: // Down arrow

                        e.preventDefault();

                        self.next();

                    break;

                    case 80: // "P"
					case 32: // Spacebar

						e.preventDefault();

						if ( self.SlideShow ) {
							e.preventDefault();

							self.SlideShow.toggle();
						}

					break;

                    case 70: // "F"

						if ( self.FullScreen ) {
							e.preventDefault();

							self.FullScreen.toggle();
						}

					break;

                    case 71: // "G"

						if ( self.Thumbs ) {
							e.preventDefault();

							self.Thumbs.toggle();
						}

					break;
                }
            });


        },


        // Remove events added by the core
        // ===============================

        removeEvents : function () {

            $W.off( 'scroll.fb resize.fb orientationchange.fb' );
            $D.off( 'keydown.fb focusin.fb click.fb-close' );

            this.$refs.container.off('click.fb-close click.fb-previous click.fb-next');
        },


        // Slide to left
        // ==================

        previous : function( duration ) {

            this.jumpTo( this.currIndex - 1, duration );

        },


        // Slide to right
        // ===================

        next : function( duration ) {

            this.jumpTo( this.currIndex + 1, duration );

        },


        // Display current gallery item, move slider to current position
        // =============================================================

        jumpTo : function ( to, duration ) {
            var self = this,
                firstRun,
                index,
                pos,
                loop;

            firstRun = self.firstRun = ( self.firstRun === null );

            index = pos = to = parseInt( to, 10 );
            loop  = self.current ? self.current.opts.loop : false;

            if ( self.isAnimating || ( index == self.currIndex && !firstRun ) ) {
                return;
            }

            if ( self.group.length > 1 && loop ) {

                index = index % self.group.length;
                index = index < 0 ? self.group.length + index : index;

                // Calculate closest position of upcoming item from the current one
                if ( self.group.length == 2 ) {
                    pos = to - self.currIndex + self.currPos;

                } else {
                    pos = index - self.currIndex + self.currPos;

                    if ( Math.abs( self.currPos - ( pos + self.group.length ) ) < Math.abs( self.currPos - pos ) ) {
                        pos = pos + self.group.length;

                    } else if ( Math.abs( self.currPos - ( pos - self.group.length ) ) < Math.abs( self.currPos - pos ) ) {
                        pos = pos - self.group.length;

                    }
                }

            } else if ( !self.group[ index ] ) {
                self.update( false, false, duration );

                return;
            }

            if ( self.current ) {
                self.current.$slide.removeClass('fancybox-slide--current fancybox-slide--complete');

                self.updateSlide( self.current, true );
            }

            self.prevIndex = self.currIndex;
            self.prevPos   = self.currPos;

            self.currIndex = index;
            self.currPos   = pos;

            // Create slides

            self.current = self.createSlide( pos );

            if ( self.group.length > 1 ) {

                if ( self.opts.loop || pos - 1 >= 0 ) {
                    self.createSlide( pos - 1 );
                }

                if ( self.opts.loop || pos + 1 < self.group.length ) {
                    self.createSlide( pos + 1 );
                }
            }

            self.current.isMoved    = false;
            self.current.isComplete = false;

            duration = parseInt( duration === undefined ? self.current.opts.speed * 1.5 : duration, 10 );

            // Move slider to the next position
            // Note: the content might still be loading
            self.trigger( 'beforeMove' );

            self.updateControls();

            if ( firstRun ) {
                self.current.$slide.addClass('fancybox-slide--current');

                self.$refs.container.show();

                requestAFrame(function() {
                    self.$refs.bg.css('transition-duration', self.current.opts.speed + 'ms');

                    self.$refs.container.addClass( 'fancybox-container--ready' );
                });
            }

            // Set position immediately on first opening
            self.update( true, false, firstRun ? 0 : duration, function() {
                self.afterMove();
            });

            self.loadSlide( self.current );

            if ( !( firstRun && self.current.$ghost ) ) {
                self.preload();
            }

        },


        // Create new "slide" element
        // These are gallery items  that are actually added to DOM
        // =======================================================

        createSlide : function( pos ) {

            var self = this;
            var $slide;
            var index;
            var found;

            index = pos % self.group.length;
            index = index < 0 ? self.group.length + index : index;

            if ( !self.slides[ pos ] && self.group[ index ] ) {

                // If we are looping and slide with that index already exists, then reuse it
                if ( self.opts.loop && self.group.length > 2 ) {
                    for (var key in self.slides) {
                        if ( self.slides[ key ].index === index ) {
                            found = self.slides[ key ];
                            found.pos = pos;

                            self.slides[ pos ] = found;

                            delete self.slides[ key ];

                            self.updateSlide( found );

                            return found;
                        }
                    }
                }

                $slide = $('<div class="fancybox-slide"></div>').appendTo( self.$refs.slider );

                self.slides[ pos ] = $.extend( true, {}, self.group[ index ], {
                    pos      : pos,
                    $slide   : $slide,
                    isMoved  : false,
                    isLoaded : false
                });

            }

            return self.slides[ pos ];

        },

        zoomInOut : function( type, duration, callback ) {

            var self     = this;
            var current  = self.current;
            var $what    = current.$placeholder;
            var opacity  = current.opts.opacity;
            var $thumb   = current.opts.$thumb;
            var thumbPos = $thumb ? $thumb.offset() : 0;
            var slidePos = current.$slide.offset();
            var props;
            var start;
            var end;

            if ( !$what || !current.isMoved || !thumbPos || !isElementInViewport( $thumb ) ) {
                return false;
            }

            if ( type === 'In' && !self.firstRun ) {
                return false;
            }

            $.fancybox.stop( $what );

            self.isAnimating = true;

            props = {
                top    : thumbPos.top  - slidePos.top  + parseFloat( $thumb.css( "border-top-width" ) || 0 ),
                left   : thumbPos.left - slidePos.left + parseFloat( $thumb.css( "border-left-width" ) || 0 ),
                width  : $thumb.width(),
                height : $thumb.height(),
                scaleX : 1,
                scaleY : 1
            };

            // Check if we need to animate opacity
            if ( opacity == 'auto' ) {
                opacity = Math.abs( current.width / current.height - props.width / props.height ) > 0.1;
            }

            if ( type === 'In' ) {
                start = props;
                end   = self.getFitPos( current );

                end.scaleX = end.width  / start.width;
                end.scaleY = end.height / start.height;

                if ( opacity ) {
                    start.opacity = 0.1;
                    end.opacity   = 1;
                }

            } else {

                start = $.fancybox.getTranslate( $what );
                end   = props;

                // Switch to thumbnail image to improve animation performance
                if ( current.$ghost ) {
                    current.$ghost.show();

                    if ( current.$image ) {
                        current.$image.remove();
                    }
                }

                start.scaleX = start.width  / end.width;
                start.scaleY = start.height / end.height;

                start.width  = end.width;
                start.height = end.height;

                if ( opacity ) {
                    end.opacity = 0;
                }

            }

            self.updateCursor( end.width, end.height );

            // There is no need to animate width/height properties
            delete end.width;
            delete end.height;

            $.fancybox.setTranslate( $what, start );

            $what.show();

            self.trigger( 'beforeZoom' + type );

            requestAFrame(function() {

                $what.css( 'transition', 'all ' + duration + 'ms' );

                $.fancybox.setTranslate( $what, end );

                setTimeout(function() {
                    requestAFrame(function() {
                        var reset;

                        $what.css( 'transition', 'none' );

                        reset = $.fancybox.getTranslate( $what );

                        reset.scaleX = 1;
                        reset.scaleY = 1;

                        // Reset scalex/scaleY values; this helps for perfomance
                        $.fancybox.setTranslate( $what, reset );

                        self.trigger( 'afterZoom' + type );

                        callback.apply( self );

                        self.isAnimating = false;
                    });
                }, duration);

            });

            return true;

        },

        // Check if image dimensions exceed parent element
        // ===============================================

        canPan : function() {

            var self = this;

            var current = self.current;
            var $what   = current.$placeholder;

            var rez = false;

            if ( $what ) {
                rez = self.getFitPos( current );
                rez = Math.abs( $what.width() - rez.width ) > 1  || Math.abs( $what.height() - rez.height ) > 1;

            }

            return rez;

        },


        // Check if current image dimensions are smaller than actual
        // =========================================================

        isScaledDown : function() {

            var self = this;

            var current = self.current;
            var $what   = current.$placeholder;

            var rez = false;

            if ( $what ) {
                rez = $.fancybox.getTranslate( $what );
                rez = rez.width < current.width || rez.height < current.height;
            }

            return rez;

        },


        // Scale image to the actual size of the image
        // ===========================================

        scaleToActual : function( x, y, duration ) {

            var self = this;

            var current = self.current;
            var $what   = current.$placeholder;

            var imgPos, posX, posY, scaleX, scaleY;

            var canvasWidth  = parseInt( current.$slide.width(), 10 );
            var canvasHeight = parseInt( current.$slide.height(), 10 );

            var newImgWidth  = current.width;
            var newImgHeight = current.height;

            if ( !$what ) {
                return;
            }

            self.isAnimating = true;

            x = x === undefined ? canvasWidth  * 0.5  : x;
            y = y === undefined ? canvasHeight * 0.5  : y;

            imgPos = $.fancybox.getTranslate( $what );

            scaleX  = newImgWidth  / imgPos.width;
            scaleY  = newImgHeight / imgPos.height;

            // Get center position for original image
            posX = ( canvasWidth * 0.5  - newImgWidth * 0.5 );
            posY = ( canvasHeight * 0.5 - newImgHeight * 0.5 );

            // Make sure image does not move away from edges

            if ( newImgWidth > canvasWidth ) {
                posX = imgPos.left * scaleX - ( ( x * scaleX ) - x );

                if ( posX > 0 ) {
                    posX = 0;
                }

                if ( posX <  canvasWidth - newImgWidth ) {
                    posX = canvasWidth - newImgWidth;
                }
            }

            if ( newImgHeight > canvasHeight) {
                posY = imgPos.top  * scaleY - ( ( y * scaleY ) - y );

                if ( posY > 0 ) {
                    posY = 0;
                }

                if ( posY <  canvasHeight - newImgHeight ) {
                    posY = canvasHeight - newImgHeight;
                }
            }

            self.updateCursor( newImgWidth, newImgHeight );

            $.fancybox.animate( $what, null, {
                top    : posY,
                left   : posX,
                scaleX : scaleX,
                scaleY : scaleY
            }, duration || current.opts.speed, function() {
                self.isAnimating = false;
            });

        },


        // Scale image to fit inside parent element
        // ========================================

        scaleToFit : function( duration ) {

            var self = this;

            var current = self.current;
            var $what   = current.$placeholder;
            var end;

            if ( !$what ) {
                return;
            }

            self.isAnimating = true;

            end = self.getFitPos( current );

            self.updateCursor( end.width, end.height );

            $.fancybox.animate( $what, null, {
                top    : end.top,
                left   : end.left,
                scaleX : end.width  / $what.width(),
                scaleY : end.height / $what.height()
            }, duration || current.opts.speed, function() {
                self.isAnimating = false;
            });

        },

        // Calculate image size to fit inside viewport
        // ===========================================

        getFitPos : function( slide ) {
            var $what = slide.$placeholder || slide.$content;

            var imgWidth  = slide.width;
            var imgHeight = slide.height;

            var margin = slide.opts.margin;

            var canvasWidth, canvasHeight, minRatio, top, left, width, height;

            if ( !$what || !$what.length || ( !imgWidth && !imgHeight) ) {
                return false;
            }

            // Convert "margin to CSS style: [ top, right, bottom, left ]
            if ( $.type( margin ) === "number" ) {
                margin = [ margin, margin ];
            }

            if ( margin.length == 2 ) {
                margin = [ margin[0], margin[1], margin[0], margin[1] ];
            }

            if ( $W.width() < 800 ) {
                margin = [0, 0, 0, 0];
            }

            canvasWidth  = parseInt( slide.$slide.width(), 10 )  - ( margin[ 1 ] + margin[ 3 ] );
            canvasHeight = parseInt( slide.$slide.height(), 10 ) - ( margin[ 0 ] + margin[ 2 ] );

            minRatio = Math.min(1, canvasWidth / imgWidth, canvasHeight / imgHeight );

            // Use floor rounding to make sure it really fits

            width  = Math.floor( minRatio * imgWidth );
            height = Math.floor( minRatio * imgHeight );

            top  = Math.floor( ( canvasHeight - height ) * 0.5 ) + margin[ 0 ];
            left = Math.floor( ( canvasWidth  - width )  * 0.5 ) + margin[ 3 ];

            return {
                top    : top,
                left   : left,
                width  : width,
                height : height
            };

        },

        // Move slider to current position
        // Update all slides (and their content)
        // =====================================

        update : function( andSlides, andContent, duration, callback ) {

            var self = this;

            var leftValue = ( self.current.pos * Math.floor( self.current.$slide.width() ) * -1 ) - ( self.current.pos * self.current.opts.gutter ) ;

            if ( self.isAnimating === true ) {
                return;
            }

            duration = parseInt( duration, 10 ) || 0;

            $.fancybox.stop( self.$refs.slider );

            if ( andSlides === false ) {
                self.updateSlide( self.current, andContent );

            } else {

                $.each( self.slides, function( key, slide ) {
                    self.updateSlide( slide, andContent );
                });

            }

            if ( duration ) {

                $.fancybox.animate( self.$refs.slider, null, {
                    top  : 0,
                    left : leftValue
                }, duration, function() {
                    self.current.isMoved = true;

                    if ( $.type( callback ) === 'function' ) {
                        callback.apply( self );
                    }

                });

            } else {

                $.fancybox.setTranslate( self.$refs.slider, { top : 0, left : leftValue } );

                self.current.isMoved = true;

                if ( $.type( callback ) === 'function' ) {
                    callback.apply( self );
                }

            }

        },


        // Update slide position and scale content to fit
        // ==============================================

        updateSlide : function( slide, andContent ) {

            var self  = this;
            var $what = slide.$placeholder;
            var leftPos;

            slide = slide || self.current;

            if ( !slide || self.isClosing ) {
                return;
            }

            leftPos = ( slide.pos * Math.floor( slide.$slide.width() )  ) + ( slide.pos * slide.opts.gutter);

            if ( leftPos !== slide.leftPos ) {
                $.fancybox.setTranslate( slide.$slide, { top: 0, left : leftPos } );

                slide.leftPos = leftPos;
            }

            if ( andContent !== false && $what ) {
                $.fancybox.setTranslate( $what, self.getFitPos( slide ) );

                if ( slide.pos === self.currPos ) {
                    self.updateCursor();
                }
            }

            slide.$slide.trigger( 'refresh' );

            self.trigger( 'onUpdate', slide );
        },

        // Update cursor style depending if content can be zoomed
        // ======================================================

        updateCursor : function( nextWidth, nextHeight ) {

            var self = this;
            var canScale;

            var $container = self.$refs.container.removeClass('fancybox-controls--canzoomIn fancybox-controls--canzoomOut fancybox-controls--canGrab');

            if ( self.isClosing || !self.opts.touch ) {
                return;
            }

            if ( nextWidth !== undefined && nextHeight !== undefined ) {
                canScale = nextWidth < self.current.width && nextHeight < self.current.height;

            } else {
                canScale = self.isScaledDown();
            }

            if ( canScale ) {
                $container.addClass('fancybox-controls--canzoomIn');

            } else if ( self.group.length < 2 ) {
                $container.addClass('fancybox-controls--canzoomOut');

            } else {
                $container.addClass('fancybox-controls--canGrab');
            }

        },

        // Load content into the slide
        // ===========================

        loadSlide : function( slide ) {

            var self = this, type, $slide;
            var ajaxLoad;

            if ( !slide || slide.isLoaded || slide.isLoading ) {
                return;
            }

            slide.isLoading = true;

            self.trigger( 'beforeLoad', slide );

            type   = slide.type;
            $slide = slide.$slide;

            $slide
                .off( 'refresh' )
                .trigger( 'onReset' )
                .addClass( 'fancybox-slide--' + ( type || 'unknown' ) )
                .addClass( slide.opts.slideClass );

            // Create content depending on the type

            switch ( type ) {

                case 'image':

                    self.setImage( slide );

                break;

                case 'iframe':

                    self.setIframe( slide );

                break;

                case 'html':

                    self.setContent( slide, slide.content );

                break;

                case 'inline':

                    if ( $( slide.src ).length ) {
                        self.setContent( slide, $( slide.src ) );

                    } else {
                        self.setError( slide );
                    }

                break;

                case 'ajax':

                    self.showLoading( slide );

                    ajaxLoad = $.ajax( $.extend( {}, slide.opts.ajax.settings, {

                        url: slide.src,

                        success: function ( data, textStatus ) {

                            if ( textStatus === 'success' ) {
                                self.setContent( slide, data );

                            }

                        },

                        error: function ( jqXHR, textStatus ) {

                            if ( jqXHR && textStatus !== 'abort' ) {
                                self.setError( slide );

                            }

                        }

                    }));

                    $slide.one( 'onReset', function () {
                        ajaxLoad.abort();
                    });

                break;

                default:

                    self.setError( slide );

                break;

            }

            return true;

        },


        // Use thumbnail image, if possible
        // ================================

        setImage : function( slide ) {

            var self   = this;
            var srcset = slide.opts.image.srcset;

            var found, temp, pxRatio, windowWidth;

            if ( slide.isLoaded && !slide.hasError ) {
                self.afterLoad( slide );

                return;
            }

            // If we have "srcset", then we need to find matching "src" value.
            // This is necessary, because when you set an src attribute, the browser will preload the image
            // before any javascript or even CSS is applied.
            if ( srcset ) {
                pxRatio     = window.devicePixelRatio || 1;
                windowWidth = window.innerWidth  * pxRatio;

                temp = srcset.split(',').map(function (el) {
            		var ret = {};

            		el.trim().split(/\s+/).forEach(function (el, i) {
                        var value = parseInt(el.substring(0, el.length - 1), 10);

            			if ( i === 0 ) {
            				return (ret.url = el);
            			}

                        if ( value ) {
                            ret.value   = value;
                            ret.postfix = el[el.length - 1];
                        }

            		});

            		return ret;
            	});

                // Sort by value
                temp.sort(function (a, b) {
                  return a.value - b.value;
                });

                // Ok, now we have an array of all srcset values
                for ( var j = 0; j < temp.length; j++ ) {
                    var el = temp[ j ];

                    if ( ( el.postfix === 'w' && el.value >= windowWidth ) || ( el.postfix === 'x' && el.value >= pxRatio ) ) {
                        found = el;
                        break;
                    }
                }

                // If not found, take the last one
                if ( !found && temp.length ) {
                    found = temp[ temp.length - 1 ];
                }

                if ( found ) {
                    slide.src = found.url;

                    // If we have default width/height values, we can calculate height for matching source
                    if ( slide.width && slide.height && found.postfix == 'w' ) {
                        slide.height = ( slide.width / slide.height ) * found.value;
                        slide.width  = found.value;
                    }
                }
            }

            slide.$placeholder = $('<div class="fancybox-placeholder"></div>')
                .hide()
                .appendTo( slide.$slide );

            if ( slide.opts.preload !== false && slide.opts.width && slide.opts.height && ( slide.opts.thumb || slide.opts.$thumb ) ) {

                slide.width  = slide.opts.width;
                slide.height = slide.opts.height;

                slide.$ghost = $('<img />')
                    .one('load error', function() {

                        if ( self.isClosing ) {
                            return;
                        }

                        // Start preloading full size image
                        $('<img/>')[0].src = slide.src;

                        // zoomIn or just show
                        self.revealImage( slide, function() {

                            self.setBigImage( slide );

                            if ( self.firstRun && slide.index === self.currIndex ) {
                                self.preload();
                            }
                        });

                    })
                    .addClass( 'fancybox-image' )
                    .appendTo( slide.$placeholder )
                    .attr( 'src', slide.opts.thumb || slide.opts.$thumb.attr( 'src' ) );

            } else {

                self.setBigImage( slide );

            }

        },


        // Create full-size image
        // ======================

        setBigImage : function ( slide ) {
            var self = this;
            var $img = $('<img />');

            slide.$image = $img
                .one('error', function() {

                    self.setError( slide );

                })
                .one('load', function() {

                    // Clear timeout that checks if loading icon needs to be displayed
                    clearTimeout( slide.timouts );
                    slide.timouts = null;

                    if ( self.isClosing ) {
                        return;
                    }

                    slide.width  = this.naturalWidth;
                    slide.height = this.naturalHeight;

                    if ( slide.opts.image.srcset ) {
                        $img.attr('sizes', '100vw').attr('srcset', slide.opts.image.srcset);
                    }

                    self.afterLoad( slide );

                    if ( slide.$ghost ) {
                        slide.timouts = setTimeout(function() {
                            slide.$ghost.hide();

                        }, 350);
                    }

                })
                .addClass('fancybox-image')
                .attr('src', slide.src)
                .appendTo( slide.$placeholder );

            if ( $img[0].complete ) {
                  $img.trigger('load');

            } else if( $img[0].error ) {
                 $img.trigger('error');

            } else {

                slide.timouts = setTimeout(function() {
                    if ( !$img[0].complete && !slide.hasError ) {
                        self.showLoading( slide );
                    }

                }, 150);

            }

            if ( slide.opts.image.protect ) {
                $('<div class="fancybox-spaceball"></div>').appendTo( slide.$placeholder ).on('contextmenu.fb',function(e){
                     if ( e.button == 2 ) {
                         e.preventDefault();
                     }

                    return true;
                });
            }

        },

        // Simply show image holder without animation
        // It has been hidden initially to avoid flickering
        // ================================================

        revealImage : function( slide, callback ) {

            var self = this;

            callback = callback || $.noop;

            if ( slide.type !== 'image' || slide.hasError || slide.isRevealed === true ) {

                callback.apply( self );

                return;
            }

            slide.isRevealed = true;

            if ( !( slide.pos === self.currPos && self.zoomInOut( 'In', slide.opts.speed, callback ) ) ) {

                if ( slide.$ghost && !slide.isLoaded ) {
                    self.updateSlide( slide, true );
                }

                if ( slide.pos === self.currPos ) {
                    $.fancybox.animate( slide.$placeholder, { opacity: 0 }, { opacity: 1 }, 300, callback );

                } else {
                    slide.$placeholder.show();
                }

                callback.apply( self );

            }

        },

        // Create iframe wrapper, iframe and bindings
        // ==========================================

        setIframe : function( slide ) {
            var self	= this,
                opts    = slide.opts.iframe,
                $slide	= slide.$slide,
                $iframe;

            slide.$content = $('<div class="fancybox-content"></div>')
                .css( opts.css )
                .appendTo( $slide );

            $iframe = $( opts.tpl.replace(/\{rnd\}/g, new Date().getTime()) )
                .attr('scrolling', $.fancybox.isTouch ? 'auto' : opts.scrolling)
                .appendTo( slide.$content );

            if ( opts.preload ) {
                slide.$content.addClass( 'fancybox-tmp' );

                self.showLoading( slide );

                // Unfortunately, it is not always possible to determine if iframe is successfully loaded
                // (due to browser security policy)

                $iframe.on('load.fb error.fb', function(e) {
                    this.isReady = 1;

                    slide.$slide.trigger( 'refresh' );

                    self.afterLoad( slide );

                });

                // Recalculate iframe content size

                $slide.on('refresh.fb', function() {
                    var $wrap = slide.$content,
                        $contents,
                        $body,
                        scrollWidth,
                        frameWidth,
                        frameHeight;

                    if ( $iframe[0].isReady !== 1 ) {
                        return;
                    }

                    // Check if content is accessible,
                    // it will fail if frame is not with the same origin

                    try {
                        $contents = $iframe.contents();
                        $body     = $contents.find('body');

                    } catch (ignore) {}

                    // Calculate dimensions for the wrapper

                    if ( $body && $body.length && !( opts.css.width !== undefined && opts.css.height !== undefined ) ) {

                        scrollWidth = $iframe[0].contentWindow.document.documentElement.scrollWidth;

                        frameWidth	= Math.ceil( $body.outerWidth(true) + ( $wrap.width() - scrollWidth ) );
                        frameHeight	= Math.ceil( $body.outerHeight(true) );

                        // Resize wrapper to fit iframe content

                        $wrap.css({
                            'width'  : opts.css.width  === undefined ? frameWidth  + ( $wrap.outerWidth()  - $wrap.innerWidth() )  : opts.css.width,
                            'height' : opts.css.height === undefined ? frameHeight + ( $wrap.outerHeight() - $wrap.innerHeight() ) : opts.css.height
                        });

                    }

                    $wrap.removeClass( 'fancybox-tmp' );

                });

            } else {

                this.afterLoad( slide );

            }

            $iframe.attr( 'src', slide.src );

            if ( slide.opts.smallBtn ) {
                slide.$content.prepend( slide.opts.closeTpl );
            }

            // Remove iframe if closing or changing gallery item

            $slide.one('onReset', function () {

                // This helps IE not to throw errors when closing

                try {

                    $(this).find('iframe').hide().attr('src', '//about:blank');

                } catch (ignore) {}

                $(this).empty();

                slide.isLoaded = false;

            });

        },


        // Wrap and append content to the slide
        // ======================================

        setContent : function ( slide, content ) {

            var self = this;

            if ( self.isClosing ) {
                return;
            }

            self.hideLoading( slide );

            slide.$slide.empty();

            if ( isQuery( content ) && content.parent().length ) {

                // If it is a jQuery object, then it will be moved to the box.
                // The placeholder is created so we will know where to put it back.
                // If user is navigating gallery fast, then the content might be already moved to the box

                if ( content.data( 'placeholder' ) ) {
                    content.parents('.fancybox-slide').trigger( 'onReset' );
                }

                content.data({'placeholder' : $('<div></div>' ).hide().insertAfter( content ) }).css('display', 'inline-block');

            } else {

                if ( $.type( content ) === 'string' ) {

                    content = $('<div>').append( content ).contents();

                    if ( content[0].nodeType === 3 ) {
                        content = $('<div>').html( content );
                    }

                }

                if ( slide.opts.selector ) {
                    content = $('<div>').html( content ).find( slide.opts.selector );
                }

            }

            slide.$slide.one('onReset', function () {
                var placeholder = isQuery( content ) ? content.data('placeholder') : 0;

                if ( placeholder ) {
                    content.hide().replaceAll( placeholder );

                    content.data( 'placeholder', null );
                }

                if ( !slide.hasError ) {
                    $(this).empty();

                    slide.isLoaded = false;
                }

            });

            slide.$content = $( content ).appendTo( slide.$slide );

            if ( slide.opts.smallBtn === true ) {
                slide.$content.find( '.fancybox-close-small' ).remove().end().eq(0).append( slide.opts.closeTpl );
            }

            this.afterLoad( slide );

        },

        // Display error message
        // =====================

        setError : function ( slide ) {

            slide.hasError = true;

            this.setContent( slide, slide.opts.errorTpl );

        },


        showLoading : function( slide ) {
            var self = this;

            slide = slide || self.current;

            if ( slide && !slide.$spinner ) {
                slide.$spinner = $( self.opts.spinnerTpl ).appendTo( slide.$slide );
            }

        },

        hideLoading : function( slide ) {

            var self = this;

            slide = slide || self.current;

            if ( slide && slide.$spinner ) {
                slide.$spinner.remove();

                delete slide.$spinner;
            }

        },

        afterMove : function() {

            var self    = this;
            var current = self.current;
            var slides  = {};

            if ( !current ) {
                return;
            }

            current.$slide.siblings().trigger( 'onReset' );

            // Remove unnecessary slides
            $.each( self.slides, function( key, slide ) {

                if (  slide.pos >= self.currPos - 1 && slide.pos <= self.currPos + 1 ) {
                    slides[ slide.pos ] = slide;

                } else if ( slide ) {
                    slide.$slide.remove();
                }

            });

            self.slides = slides;

            self.trigger( 'afterMove' );

            if ( current.isLoaded ) {
                self.complete();
            }

        },

        // Adjustments after slide has been loaded
        // =======================================

        afterLoad : function( slide ) {

            var self = this;

            if ( self.isClosing ) {
                return;
            }

            slide.isLoading = false;
            slide.isLoaded  = true;

            self.trigger( 'afterLoad', slide );

            self.hideLoading( slide );

            // Resize content to fit inside slide
            // Skip if slide has an $ghost element, because then it has been already processed
            if ( !slide.$ghost ) {
                self.updateSlide( slide, true );
            }

            if ( slide.index === self.currIndex && slide.isMoved ) {
                self.complete();

            } else if ( !slide.$ghost ) {
                self.revealImage( slide );
            }

        },


        // Final adjustments after current gallery item is moved to position
        // and it`s content is loaded
        // ==================================================================

        complete : function() {

            var self = this;

            var current = self.current;

            self.revealImage( current, function() {
                current.isComplete = true;

                current.$slide.addClass('fancybox-slide--complete');

                self.updateCursor();

                self.trigger( 'onComplete' );

                // Try to focus on the first focusable element, skip for images and iframes
                if ( current.opts.focus && !( current.type === 'image' || current.type === 'iframe' ) ) {
                    self.focus();
                }

            });

        },


        // Preload next and previous slides
        // ================================

        preload : function() {
            var self = this;
            var next, prev;

            if ( self.group.length < 2 ) {
                return;
            }

            next  = self.slides[ self.currPos + 1 ];
            prev  = self.slides[ self.currPos - 1 ];

            if ( next && next.type === 'image' ) {
                self.loadSlide( next );
            }

            if ( prev && prev.type === 'image' ) {
                self.loadSlide( prev );
            }

        },


        // Try to find and focus on the first focusable element
        // ====================================================

        focus : function() {

            var current = this.current;
            var $el;

            $el = current && current.isComplete ? current.$slide.find('button,:input,[tabindex],a:not(".disabled")').filter(':visible:first') : null;

            if ( !$el || !$el.length ) {
                $el = this.$refs.container;

            }

            $el.focus();

            // Scroll position of wrapper element sometimes changes after focusing (IE)
            this.$refs.slider_wrap.scrollLeft(0);

            // And the same goes for slide element
            if ( current ) {
                current.$slide.scrollTop(0);
            }

        },


        // Activates current instance - brings container to the front and enables keyboard,
        // notifies other instances about deactivating
        // =================================================================================

        activate : function () {
            var self = this;

            // Deactivate all instances

            $( '.fancybox-container' ).each(function () {
                var instance = $(this).data( 'FancyBox' );

                // Skip self and closing instances

                if (instance && instance.uid !== self.uid && !instance.isClosing) {
                    instance.trigger( 'onDeactivate' );
                }

            });

            if ( self.current ) {

                if ( self.$refs.container.index() > 0 ) {
                    self.$refs.container.prependTo( document.body );
                }

                self.updateControls();
            }

            self.trigger( 'onActivate' );

            self.addEvents();

        },


        // Start closing procedure
        // This will start "zoom-out" animation if needed and clean everything up afterwards
        // =================================================================================

        close : function( e ) {

            var self     = this;
            var current  = self.current;
            var duration = current.opts.speed;

            var done = $.proxy(function() {

                self.cleanUp( e );  // Now "this" is again our instance

            }, this);

            if ( self.isAnimating || self.isClosing ) {
                return false;
            }

            self.isClosing = true;

            if ( current.timouts ) {
                clearTimeout( current.timouts );
            }

            if ( e !== true) {
                $.fancybox.stop( self.$refs.slider );
            }

            self.$refs.container
                .removeClass('fancybox-container--active')
                .addClass('fancybox-container--closing');

            current.$slide
                .removeClass('fancybox-slide--complete')
                .siblings()
                .remove();


            if ( !current.isMoved ) {
                current.$slide.css('overflow', 'visible');
            }

            // Remove all events
            // If there are multiple instances, they will be set again by "activate" method

            self.removeEvents();

            // Clean up

            self.hideLoading( current );

            self.hideControls();

            self.updateCursor();

            self.trigger( 'beforeClose', current, e );

            self.$refs.bg.css('transition-duration', duration + 'ms');

            this.$refs.container.removeClass( 'fancybox-container--ready' );

            if ( e === true ) {
                setTimeout( done, duration );

            } else if ( !self.zoomInOut( 'Out', duration, done ) ) {
                $.fancybox.animate( self.$refs.container, null, { opacity : 0 }, duration, "easeInSine", done );
            }

        },


        // Final adjustments after removing the instance
        // =============================================

        cleanUp : function( e ) {
            var self = this,
                instance;

            self.$refs.slider.children().trigger( 'onReset' );

            self.$refs.container.empty().remove();

            self.current = null;

            self.trigger( 'afterClose', e);

            // Check if there are other instances

            instance = $.fancybox.getInstance();

            if ( instance ) {
                instance.activate();

            } else {

                $( 'html' ).removeClass( 'fancybox-enabled' );

                $( '#fancybox-noscroll' ).remove();

            }

            // Place back focus
            if ( self.$lastFocus ) {
                self.$lastFocus.focus();
            }

            $W.scrollTop( self.scrollTop ).scrollLeft( self.scrollLeft );

        },


        // Call callback and trigger an event
        // ==================================

        trigger : function( name, slide ) {
            var args  = Array.prototype.slice.call(arguments, 1),
                self  = this,
                obj   = slide && slide.opts ? slide : self.current;

            if ( obj ) {
                args.unshift( obj );

            } else {
                obj = self;
            }

            args.unshift( self );

            if ( $.isFunction( obj.opts[ name ] ) ) {
                obj.opts[ name ].apply( obj, args );
            }

            self.$refs.container.trigger( name + '.fb', args);

        },


        // Toggle toolbar and caption
        // ==========================

        toggleControls : function( force ) {

            if ( this.isHiddenControls ) {
                this.updateControls( force );

            } else {
                this.hideControls();
            }


        },


        // Hide toolbar and caption
        // ========================

        hideControls : function () {

            this.isHiddenControls = true;

            this.$refs.container.removeClass('fancybox-show-controls');

            this.$refs.container.removeClass('fancybox-show-caption');

        },


        // Update infobar values, navigation button states and reveal caption
        // ==================================================================

        updateControls : function ( force ) {

            var self = this;

            var $container = self.$refs.container;
            var $caption   = self.$refs.caption;

            // Toggle infobar and buttons

            var current  = self.current;
            var index    = current.index;
            var opts     = current.opts;
            var caption  = opts.caption;

            if ( this.isHiddenControls && force !== true ) {
                return;
            }

            this.isHiddenControls = false;

            self.$refs.container.addClass('fancybox-show-controls');

            $container
                .toggleClass('fancybox-show-infobar', !!opts.infobar && self.group.length > 1)
                .toggleClass('fancybox-show-buttons', !!opts.buttons )
                .toggleClass('fancybox-is-modal',     !!opts.modal );

            $('.fancybox-button--left',  $container).toggleClass( 'fancybox-button--disabled', (!opts.loop && index <= 0 ) );
            $('.fancybox-button--right', $container).toggleClass( 'fancybox-button--disabled', (!opts.loop && index >= self.group.length - 1) );

            $('.fancybox-button--play',  $container).toggle( !!( opts.slideShow && self.group.length > 1) );
            $('.fancybox-button--close', $container).toggle( !!opts.closeBtn );

            // Update infobar values

            $('.js-fancybox-count', $container).html( self.group.length );
            $('.js-fancybox-index', $container).html( index + 1 );

            // Recalculate content dimensions
            current.$slide.trigger( 'refresh' );

            // Reveal or create new caption
            if ( $caption ) {
                $caption.empty();
            }

            if ( caption && caption.length ) {
                $caption.html( caption );

                this.$refs.container.addClass( 'fancybox-show-caption ');

                self.$caption = $caption;

            } else {
                this.$refs.container.removeClass( 'fancybox-show-caption' );

            }

        }

    });


    $.fancybox = {

        version  : "{fancybox-version}",
        defaults : defaults,


        // Get current instance and execute a command.
        //
        // Examples of usage:
        //
        //   $instance = $.fancybox.getInstance();
        //   $.fancybox.getInstance().jumpTo( 1 );
        //   $.fancybox.getInstance( 'jumpTo', 1 );
        //   $.fancybox.getInstance( function() {
        //       console.info( this.currIndex );
        //   });
        // ======================================================

        getInstance : function ( command ) {
            var instance = $('.fancybox-container:not(".fancybox-container--closing"):first').data( 'FancyBox' );
            var args     = Array.prototype.slice.call(arguments, 1);

            if ( instance instanceof FancyBox ) {

                if ( $.type( command ) === 'string' ) {
                    instance[ command ].apply( instance, args );

                } else if ( $.type( command ) === 'function' ) {
                    command.apply( instance, args );

                }

                return instance;
            }

            return false;

        },


        // Create new instance
        // ===================

        open : function ( items, opts, index ) {
            return new FancyBox( items, opts, index );
        },


        // Close current or all instances
        // ==============================

        close : function ( all ) {
            var instance = this.getInstance();

            if ( instance ) {
                instance.close();

                // Try to find and close next instance

                if ( all === true ) {
                    this.close();
                }
            }

        },


        // Test for the existence of touch events in the browser
        // Limit to mobile devices
        // ====================================================

        isTouch : document.createTouch !== undefined && /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent),


        // Detect if 'translate3d' support is available
        // ============================================

        use3d : (function() {
            var div = document.createElement('div');

            return window.getComputedStyle( div ).getPropertyValue('transform') && !(document.documentMode && document.documentMode <= 11);
        }()),


        // Helper function to get current visual state of an element
        // returns array[ top, left, horizontal-scale, vertical-scale, opacity ]
        // =====================================================================

        getTranslate : function( $el ) {
            var position, matrix;

            if ( !$el || !$el.length ) {
                return false;
            }

            position = $el.get( 0 ).getBoundingClientRect();
            matrix   = $el.eq( 0 ).css('transform');

            if ( matrix && matrix.indexOf( 'matrix' ) !== -1 ) {
                matrix = matrix.split('(')[1];
                matrix = matrix.split(')')[0];
                matrix = matrix.split(',');
            } else {
                matrix = [];
            }

            if ( matrix.length ) {

                // If IE
                if ( matrix.length > 10 ) {
                    matrix = [ matrix[13], matrix[12], matrix[0], matrix[5] ];

                } else {
                    matrix = [ matrix[5], matrix[4], matrix[0], matrix[3]];
                }

                matrix = matrix.map(parseFloat);

            } else {
                matrix = [ 0, 0, 1, 1 ];
            }

            return {
                top     : matrix[ 0 ],
                left    : matrix[ 1 ],
                scaleX  : matrix[ 2 ],
                scaleY  : matrix[ 3 ],
                opacity : parseFloat( $el.css('opacity') ),
                width   : position.width,
                height  : position.height
            };

        },


        // Shortcut for setting "translate3d" properties for element
        // Can set be used to set opacity, too
        // ========================================================

        setTranslate : function( $el, props ) {
            var str  = '';
            var css  = {};

            if ( !$el || !props ) {
                return;
            }

            if ( props.left !== undefined || props.top !== undefined ) {

                str = ( props.left === undefined ? $el.position().top : props.left )  + 'px, ' + ( props.top === undefined ? $el.position().top : props.top ) + 'px';

                if ( this.use3d ) {
                    str = 'translate3d(' + str + ', 0px)';

                } else {
                    str = 'translate(' + str + ')';
                }

            }

            if ( props.scaleX !== undefined && props.scaleY !== undefined ) {
                str = (str.length ? str + ' ' : '') + 'scale(' + props.scaleX + ', ' + props.scaleY + ')';
            }

            if ( str.length ) {
                css.transform = str;
            }

            if ( props.opacity !== undefined ) {
                css.opacity = props.opacity;
            }

            if ( props.width !== undefined ) {
                css.width = props.width;
            }

            if ( props.height !== undefined ) {
                css.height = props.height;
            }

            return $el.css( css );

        },


        // Common easings for entrances and exits
        // t: current time, b: begInnIng value, c: change In value, d: duration
        // ====================================================================

        easing : {
            easeOutCubic : function (t, b, c, d) {
                return c * ((t=t/d-1)*t*t + 1) + b;
            },
            easeInCubic : function (t, b, c, d) {
                return c * (t/=d)*t*t + b;
            },
            easeOutSine : function (t, b, c, d) {
                return c * Math.sin(t/d * (Math.PI/2)) + b;
            },
            easeInSine : function (t, b, c, d) {
                return -c * Math.cos(t/d * (Math.PI/2)) + c + b;
            }
        },


        // Stop fancyBox animation
        // =======================

        stop : function( $el ) {

            $el.removeData( 'animateID' );

        },

        // Animate element using "translate3d"
        // Usage:
        // animate( element, start properties, end properties, duration, easing, callback )
        // or
        // animate( element, start properties, end properties, duration, callback )
        // =================================================================================

        animate : function( $el, from, to, duration, easing, done ) {

            var self = this;

            var lastTime = null;
            var animTime = 0;

            var curr;
            var diff;
            var id;

            var finish = function() {
                if ( to.scaleX !== undefined && to.scaleY !== undefined && from && from.width !== undefined && from.height !== undefined ) {
                    to.width  = from.width  * to.scaleX;
                    to.height = from.height * to.scaleY;

                    to.scaleX = 1;
                    to.scaleY = 1;
                }

                self.setTranslate( $el, to );

                done();
            }

            var frame = function ( timestamp ) {
                curr = [];
                diff = 0;

                // If "stop" method has been called on this element, then just stop
                if ( !$el.length || $el.data( 'animateID' ) !== id ) {
                    return;
                }

                timestamp = timestamp || Date.now();

                if ( lastTime ) {
                    diff = timestamp - lastTime;
                }

                lastTime = timestamp;
                animTime += diff;

                // Are we done?
                if ( animTime >= duration ) {

                    finish();

                    return;
                }

                for ( var prop in to ) {

                    if ( to.hasOwnProperty( prop ) && from[ prop ] !== undefined ) {

                        if ( from[ prop ] == to[ prop ] ) {
                            curr[ prop ] = to[ prop ];

                        } else {
                            curr[ prop ] = self.easing[ easing ]( animTime, from[ prop ], to[ prop ] - from[ prop ], duration );
                        }

                    }
                }

                self.setTranslate( $el, curr );

                requestAFrame( frame );
            };

            self.animateID = id = self.animateID === undefined ? 1 : self.animateID + 1;

            $el.data( 'animateID', id );

            if ( done === undefined && $.type(easing) == 'function' ) {
                done   = easing;
                easing = undefined;
            }

            if ( !easing ) {
                easing = "easeOutCubic";
            }

            done = done || $.noop;

            if ( from ) {
                this.setTranslate( $el, from );

            } else {

                // We need current values to calculate change in time
                from = this.getTranslate( $el );
            }

            if ( duration ) {
                $el.show();

                requestAFrame( frame );

            } else {
                finish();
            }

        }

    };


    // Event handler for click event to "fancyboxed" links
    // ===================================================

    function _run( e ) {
        var target	= e.currentTarget,
            opts	= e.data ? e.data.options : {},
            items	= e.data ? e.data.items : [],
            value	= '',
            index	= 0;

        e.preventDefault();
        e.stopPropagation();

        // Get all related items and find index for clicked one

        if ( $(target).attr( 'data-fancybox' ) ) {
            value = $(target).data( 'fancybox' );
        }

        if ( value ) {
            items = items.length ? items.filter( '[data-fancybox="' + value + '"]' ) : $( '[data-fancybox=' + value + ']' );
            index = items.index( target );

        } else {
            items = [ target ];
        }

        $.fancybox.open( items, opts, index );
    }


    // Create a jQuery plugin
    // ======================

    $.fn.fancybox = function (options) {

        this.off('click.fb-start').on('click.fb-start', {
            items   : this,
            options : options || {}
        }, _run);

        return this;

    };


    // Self initializing plugin
    // ========================

    $(document).on('click.fb-start', '[data-fancybox]', _run);

}(window, document, window.jQuery));
