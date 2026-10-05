import { Body, Controller, Delete, Get, Param, Post, Put, Query, UploadedFile, UseInterceptors, Res, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { MAX_EVIDENCE_BYTES } from './evidence';
import type { EvidenceFile } from './evidence';
import { FileInterceptor } from '@nestjs/platform-express';
import { ElasticsearchService } from './elasticsearch.service';
import type { IntelDashboardInput, SearchDocumentsInput, SearchEntitiesInput, SearchEventsInput, SearchIntelInput, SearchLinksInput, SearchObservationsInput } from './elasticsearch.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CcocOnly } from '../common/decorators/ccoc-only.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/constants/roles.constant';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

// ── Shorthand role arrays ─────────────────────────────────────────────────────
const AllRoles = [Role.OFFICIER, Role.ANALYSTE, Role.CONSEILLER, Role.COORDINATEUR, Role.ADMIN] as const;
const AnalysteAndAbove = [Role.ANALYSTE, Role.CONSEILLER, Role.COORDINATEUR, Role.ADMIN] as const;
const CoordAndAdmin = [Role.COORDINATEUR, Role.ADMIN] as const;

@Controller('api')
export class ElasticsearchController {
  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  // ── Entities ─────────────────────────────────────────────────────────────────

  @Post('entities/search')
  @Roles(...AnalysteAndAbove)
  searchEntities(@Body() body: SearchEntitiesInput = {}) {
    return this.elasticsearchService.searchEntities(body);
  }

  @Get('entities/:id')
  @Roles(...AnalysteAndAbove)
  getEntityById(@Param('id') id: string) {
    return this.elasticsearchService.getEntityById(id);
  }

  @Post('entities')
  @Roles(...AnalysteAndAbove)
  createEntity(@Body() body: Record<string, unknown> = {}) {
    return this.elasticsearchService.saveEntity(body);
  }

  @Put('entities/:id')
  @Roles(...AnalysteAndAbove)
  updateEntity(@Param('id') id: string, @Body() body: Record<string, unknown> = {}) {
    return this.elasticsearchService.saveEntity(body, id);
  }

  @Delete('entities/:id')
  @Roles(Role.ADMIN)
  deleteEntity(@Param('id') id: string) {
    return this.elasticsearchService.deleteEntity(id);
  }

  @Post('uploads/entity-photo')
  @Roles(...AnalysteAndAbove)
  @UseInterceptors(FileInterceptor('photo'))
  uploadEntityPhoto(@UploadedFile() file: any, @CurrentUser() user: JwtPayload) {
    return this.elasticsearchService.uploadEntityPhoto(file, user);
  }

  @Post('uploads/evidence')
  @Roles(...AllRoles)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_EVIDENCE_BYTES, files: 1, fields: 2 } }))
  uploadEvidence(@UploadedFile() file: EvidenceFile, @Body('context') context: string,
    @Body('classification') classification: string, @CurrentUser() user: JwtPayload) {
    return this.elasticsearchService.uploadEvidence(file, context, classification, user);
  }

  @Get('evidence/:id')
  @Roles(...AllRoles)
  getEvidence(@Param('id') id: string, @Query('context') context: string,
    @Query('recordId') recordId: string, @CurrentUser() user: JwtPayload) {
    return this.elasticsearchService.getEvidenceById(id, user, context, recordId);
  }

  @Get('evidence/:id/file')
  @Roles(...AllRoles)
  async getEvidenceFile(@Param('id') id: string, @Query('context') context: string,
    @Query('recordId') recordId: string, @CurrentUser() user: JwtPayload, @Res() response: Response) {
    const file = await this.elasticsearchService.getEvidenceFile(id, user, context, recordId);
    response.setHeader('Content-Type', file.mime);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.title)}`);
    await new Promise<void>((resolve, reject) => {
      response.sendFile(file.path, (error) => {
        if (!error) resolve();
        else if (response.headersSent) resolve();
        else reject(new HttpException('Fichier introuvable ou indisponible', HttpStatus.NOT_FOUND));
      });
    });
  }

  // ── Links / Relations ───────────────────────────────────────────────────────

  @Get('links')
  @Roles(...AnalysteAndAbove)
  getLinks(
    @Query('linkType') linkType?: string,
    @Query('selectedLinkType') selectedLinkType?: string,
    @Query('fromEntity') fromEntity?: string,
    @Query('selectedFromEntity') selectedFromEntity?: string,
    @Query('toEntity') toEntity?: string,
    @Query('selectedToEntity') selectedToEntity?: string,
    @Query('search') search?: string,
    @Query('size') size?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    const parsedSize = size ? Number(size) : undefined;
    return this.elasticsearchService.searchLinks(
      { linkType, selectedLinkType, fromEntity, selectedFromEntity, toEntity, selectedToEntity, search, size: parsedSize },
      user,
    );
  }

  @Post('links/search')
  @Roles(...AnalysteAndAbove)
  searchLinks(@Body() body: SearchLinksInput = {}, @CurrentUser() user: JwtPayload) {
    return this.elasticsearchService.searchLinks(body, user);
  }

  @Get('links/:id')
  @Roles(...AnalysteAndAbove)
  getLinkById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.elasticsearchService.getLinkById(id, user);
  }

  @Post('links')
  @Roles(...AnalysteAndAbove)
  createLink(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: JwtPayload) {
    return this.elasticsearchService.saveLink(body, undefined, user);
  }

  @Put('links/:id')
  @Roles(...AnalysteAndAbove)
  updateLink(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: JwtPayload) {
    return this.elasticsearchService.saveLink(body, id, user);
  }

  @Delete('links/:id')
  @Roles(...CoordAndAdmin)
  deleteLink(@Param('id') id: string) {
    return this.elasticsearchService.deleteLink(id);
  }

  // ── Intel (Renseignements) ──────────────────────────────────────────────────

  @Get('intel')
  @Roles(Role.ANALYSTE, Role.ADMIN)
  @CcocOnly()
  getIntel(
    @Query('search') search?: string,
    @Query('province_region') province_region?: string,
    @Query('territoire_ville') territoire_ville?: string,
    @Query('event') event?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('size') size?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    const parsedSize = size ? Number(size) : undefined;
    return this.elasticsearchService.searchIntel(
      { search, province_region, territoire_ville, event, dateFrom, dateTo, size: parsedSize },
      user,
    );
  }

  @Post('intel/search')
  @Roles(Role.ANALYSTE, Role.ADMIN)
  @CcocOnly()
  searchIntel(@Body() body: SearchIntelInput = {}, @CurrentUser() user: JwtPayload) {
    return this.elasticsearchService.searchIntel(body, user);
  }

  @Get('intel/:id')
  @Roles(Role.ANALYSTE, Role.ADMIN)
  @CcocOnly()
  getIntelById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.elasticsearchService.getIntelById(id, user);
  }

  @Post('intel')
  @Roles(Role.ANALYSTE, Role.ADMIN)
  @CcocOnly()
  createIntel(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: JwtPayload) {
    return this.elasticsearchService.saveIntel(body, undefined, user);
  }

  @Put('intel/:id')
  @Roles(Role.ANALYSTE, Role.ADMIN)
  @CcocOnly()
  updateIntel(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: JwtPayload) {
    return this.elasticsearchService.saveIntel(body, id, user);
  }

  @Delete('intel/:id')
  @Roles(Role.ADMIN)
  deleteIntel(@Param('id') id: string) {
    return this.elasticsearchService.deleteIntel(id);
  }

  // ── Intel Dashboard ──────────────────────────────────────────────────────────

  @Get('intel-dashboard/provinces')
  @Roles(...AnalysteAndAbove)
  @CcocOnly()
  getIntelProvinces() {
    return this.elasticsearchService.getIntelProvinces();
  }

  @Get('intel-dashboard/territoires')
  @Roles(...AnalysteAndAbove)
  @CcocOnly()
  getIntelTerritoires(@Query('province') province: string) {
    return this.elasticsearchService.getIntelTerritoires(province);
  }

  @Get('intel-dashboard/data')
  @Roles(...AnalysteAndAbove)
  @CcocOnly()
  getIntelDashboardGet(
    @Query('province') province?: string,
    @Query('territoire') territoire?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('size') size?: string,
  ) {
    const parsedSize = size ? Number(size) : undefined;
    return this.elasticsearchService.getIntelDashboard({ province, territoire, dateFrom, dateTo, size: parsedSize });
  }

  @Post('intel-dashboard/data')
  @Roles(...AnalysteAndAbove)
  @CcocOnly()
  getIntelDashboardPost(@Body() body: IntelDashboardInput = {}) {
    return this.elasticsearchService.getIntelDashboard(body);
  }

  // ── Observations ─────────────────────────────────────────────────────────

  @Get('observations')
  @Roles(...AllRoles)
  getObservations(
    @Query('search') search?: string,
    @Query('obs_type') obs_type?: string,
    @Query('source_reliability') source_reliability?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('size') size?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    const parsedSize = size ? Number(size) : undefined;
    return this.elasticsearchService.searchObservations(
      { search, obs_type, source_reliability, dateFrom, dateTo, size: parsedSize },
      user,
    );
  }

  @Post('observations/search')
  @Roles(...AllRoles)
  searchObservations(@Body() body: SearchObservationsInput = {}, @CurrentUser() user: JwtPayload) {
    return this.elasticsearchService.searchObservations(body, user);
  }

  @Get('observations/desks')
  @Roles(...AllRoles)
  observationDesks(@CurrentUser() user: JwtPayload) {
    return this.elasticsearchService.listObservationDesks(user);
  }

  @Put('observations/:id/validation')
  @Roles(...AllRoles)
  validateObservation(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: JwtPayload) {
    return this.elasticsearchService.validateObservation(id, body, user);
  }

  @Get('observations/:id')
  @Roles(...AllRoles)
  getObservationById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.elasticsearchService.getObservationById(id, user);
  }

  @Post('observations')
  @Roles(...AllRoles)
  createObservation(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: JwtPayload) {
    return this.elasticsearchService.saveObservation(body, undefined, user);
  }

  @Put('observations/:id')
  @Roles(...AllRoles)
  updateObservation(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: JwtPayload) {
    return this.elasticsearchService.saveObservation(body, id, user);
  }

  @Delete('observations/:id')
  @Roles(...AllRoles)
  deleteObservation(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.elasticsearchService.deleteObservation(id, user);
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  @Get('events')
  @Roles(...AnalysteAndAbove)
  getEvents(
    @Query('search') search?: string,
    @Query('event_type') event_type?: string,
    @Query('classification_level') classification_level?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('size') size?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    const parsedSize = size ? Number(size) : undefined;
    return this.elasticsearchService.searchEvents(
      { search, event_type, classification_level, dateFrom, dateTo, size: parsedSize },
      user,
    );
  }

  @Post('events/search')
  @Roles(...AnalysteAndAbove)
  searchEvents(@Body() body: SearchEventsInput = {}, @CurrentUser() user: JwtPayload) {
    return this.elasticsearchService.searchEvents(body, user);
  }

  @Get('events/:id')
  @Roles(...AnalysteAndAbove)
  getEventById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.elasticsearchService.getEventById(id, user);
  }

  @Post('events')
  @Roles(...AnalysteAndAbove)
  createEvent(@Body() body: Record<string, unknown> = {}, @CurrentUser() user: JwtPayload) {
    return this.elasticsearchService.saveEvent(body, undefined, user);
  }

  @Put('events/:id')
  @Roles(...AnalysteAndAbove)
  updateEvent(@Param('id') id: string, @Body() body: Record<string, unknown> = {}, @CurrentUser() user: JwtPayload) {
    return this.elasticsearchService.saveEvent(body, id, user);
  }

  @Delete('events/:id')
  @Roles(...CoordAndAdmin)
  deleteEvent(@Param('id') id: string) {
    return this.elasticsearchService.deleteEvent(id);
  }

  // ── Documents ──────────────────────────────────────────────────────────────

  @Get('documents')
  @Roles(...AnalysteAndAbove)
  getDocuments(
    @Query('search') search?: string,
    @Query('doc_type') doc_type?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('size') size?: string,
  ) {
    const parsedSize = size ? Number(size) : undefined;
    return this.elasticsearchService.searchDocuments({ search, doc_type, dateFrom, dateTo, size: parsedSize });
  }

  @Post('documents/search')
  @Roles(...AnalysteAndAbove)
  searchDocuments(@Body() body: SearchDocumentsInput = {}) {
    return this.elasticsearchService.searchDocuments(body);
  }

  @Get('documents/:id')
  @Roles(...AnalysteAndAbove)
  getDocumentById(@Param('id') id: string) {
    return this.elasticsearchService.getPublicDocument(id);
  }

  @Post('documents')
  @Roles(...CoordAndAdmin)
  createDocument(@Body() body: Record<string, unknown> = {}) {
    return this.elasticsearchService.savePublicDocument(body);
  }

  @Put('documents/:id')
  @Roles(...CoordAndAdmin)
  updateDocument(@Param('id') id: string, @Body() body: Record<string, unknown> = {}) {
    return this.elasticsearchService.savePublicDocument(body, id);
  }

  @Delete('documents/:id')
  @Roles(Role.ADMIN)
  deleteDocument(@Param('id') id: string) {
    return this.elasticsearchService.deletePublicDocument(id);
  }
}
