import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
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

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

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
