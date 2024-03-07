import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { OrderBooksService } from './order-books/order-books.service';
import { OptimalPriceDto } from './dto/optimal.dto';
import { CreateOrderDto } from './dto/order.dto';
import { ReqUser, User } from './decorators';

@Controller()
export class AppController {
  constructor(private readonly orderBookService: OrderBooksService) {}

  @Get('optimal')
  async optimal(@Query() query: OptimalPriceDto, @User() user: ReqUser) {
    return this.orderBookService.getOptimalPrice(query, user.id);
  }

  @HttpCode(201)
  @Post('order')
  async order(@Body() { estimateId }: CreateOrderDto, @User() user: ReqUser) {
    return this.orderBookService.createOrder(estimateId, user.id);
  }

  @HttpCode(418)
  @Get('tecito')
  async teapot() {
    return '🍵';
  }
}
