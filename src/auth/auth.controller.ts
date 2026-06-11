import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtGuard } from './guard/jwt.guard';
import { GoogleOAuthGuard } from './guard/google.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  //- Redirige l'utilisateur vers la page de connexion Google
  @UseGuards(GoogleOAuthGuard)
  @Get('google')
  googleAuth() {}

  //- Reçoit le callback de Google après authentification
  //- req.user contient les infos extraites par GoogleStrategy.validate()
  @UseGuards(GoogleOAuthGuard)
  @Get('google/callback')
  googleAuthCallback(@Req() req) {
    return this.authService.googleLogin(req.user);
  }

  //- Throttle strict : 5 tentatives / minute par IP — limite le brute force sur l'inscription
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  //- Throttle strict : 5 tentatives / minute par IP — limite le brute force sur le login
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  //- Throttle strict : 5 tentatives / minute par IP
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  @Post('google/mobile')
  googleMobile(@Body('accessToken') accessToken: string) {
    return this.authService.googleLoginMobile(accessToken);
  }

  //- Throttle strict : 10 tentatives / minute par IP — un peu plus permissif (refresh légitime fréquent)
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  @Post('refresh')
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @UseGuards(JwtGuard)
  @Post('logout')
  logout(@Req() req) {
    return this.authService.logout(req.user.id);
  }
}
