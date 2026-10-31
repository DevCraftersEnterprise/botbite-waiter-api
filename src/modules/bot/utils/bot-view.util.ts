import {
  BotBranchConfig,
  BotCatalogItem,
} from '@/modules/bot/dto/bot-branch.response';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { MenuItem } from '@/modules/menus/entities/menu-item.entity';

const toNumberOrNull = (value: number | string | null): number | null =>
  value === null ? null : Number(value);

/** Postgres entrega `numeric` como texto y `time` con segundos. */
export const toBotBranchConfig = (branch: Branch): BotBranchConfig => ({
  id: branch.id,
  slug: branch.slug,
  name: branch.name,
  phoneNumberAssistant: branch.phoneNumberAssistant,
  phoneNumberReception: branch.phoneNumberReception,
  whatsappPhoneNumberId: branch.whatsappPhoneNumberId,
  botBaseUrl: branch.botBaseUrl,
  latitude: toNumberOrNull(branch.latitude),
  longitude: toNumberOrNull(branch.longitude),
  verifyLocation: branch.verifyLocation,
  geofenceMeters: branch.geofenceMeters,
  qrCodeMinutes: branch.qrCodeMinutes,
  validTables: branch.validTables,
  sessionHours: branch.sessionHours,
  postSaleHours: branch.postSaleHours,
  maxRecommendations: branch.maxRecommendations,
  timezone: branch.timezone,
  dailyCloseTime: branch.dailyCloseTime.slice(0, 5),
  surveyUrl: branch.surveyUrl,
  features: branch.features,
});

const byMenuPosition = (a: MenuItem, b: MenuItem): number =>
  a.category.sortOrder - b.category.sortOrder ||
  a.category.name.localeCompare(b.category.name) ||
  a.sortOrder - b.sortOrder ||
  a.product.name.localeCompare(b.product.name);

/**
 * Catálogo tal como lo consume el bot. Incluye los platillos apagados porque el
 * bot responde que no los tiene, en lugar de no reconocerlos.
 */
export const toBotCatalog = (items: MenuItem[]): BotCatalogItem[] =>
  items
    .filter((item) => item.product && item.category)
    .sort(byMenuPosition)
    .map((item) => ({
      id: item.id,
      name: item.product.name,
      description: item.product.description ?? '',
      price: Number(item.price),
      category: item.category.name,
      variantGroup: item.variantGroup,
      isActive:
        item.isActive && item.product.isActive && item.category.isActive,
      isRecommended: item.shouldRecommend,
      imageUrl: item.product.imageUrl ?? null,
    }));
