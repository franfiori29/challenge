import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { OrderBooksService } from './order-books/order-books.service';
import { OptimalPriceDto } from './dto/optimal.dto';
import { CreateOrderDto } from './dto/order.dto';

@Controller()
export class AppController {
  constructor(private readonly orderBookService: OrderBooksService) {}

  @Get('optimal')
  async optimal(@Query() query: OptimalPriceDto) {
    return this.orderBookService.getOptimalPrice(query);
  }

  @HttpCode(201)
  @Post('order')
  async order(@Body() { estimateId }: CreateOrderDto) {
    return this.orderBookService.createOrder(estimateId);
  }

  @HttpCode(418)
  @Get('tecito')
  async teapot() {
    return '🍵';
  }
}
